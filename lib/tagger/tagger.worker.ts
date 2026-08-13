import { AutoModelForSequenceClassification, AutoTokenizer, env } from '@huggingface/transformers';

/**
 * 감정 모델을 돌리는 Web Worker입니다.
 *
 * 메인 스레드에서 돌리면 추론하는 동안 화면이 멈춥니다. 소감 200자에 50ms 남짓이라
 * 짧지만, 구형 기기에서는 입력이 끊기는 게 보입니다.
 *
 * 여기서는 **로짓만 뽑아 넘깁니다.** 라벨을 만드는 건 `tagger.js`가 하고, 그쪽은
 * 모델을 모릅니다. τ가 바뀌어도 모델을 다시 돌릴 필요가 없는 구조입니다.
 */

// 우리가 변환한 ONNX라 HuggingFace에 없습니다. 원격 조회를 아예 막아서
// 오프라인이나 방화벽 뒤에서도 같은 경로만 보게 합니다.
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';

const MODEL_ID = 'koelectra-small-v3-nsmc';

type Incoming = { type: 'warmup' } | { type: 'tag'; id: number; text: string };

type Outgoing =
  | { type: 'ready' }
  | { type: 'result'; id: number; logits: number[] }
  | { type: 'error'; id: number; message: string };

const post = (message: Outgoing) => self.postMessage(message);

/**
 * WebGPU를 먼저 보고 없으면 WASM으로 내려갑니다(축 2 정의).
 */
const loadBundle = async () => {
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);

  const withDevice = (device: 'webgpu' | 'wasm') =>
    AutoModelForSequenceClassification.from_pretrained(MODEL_ID, { device, dtype: 'q8' });

  try {
    return { tokenizer, model: await withDevice('webgpu') };
  } catch {
    // WebGPU 미지원이거나 어댑터를 못 잡는 경우입니다. 실패를 삼키고 WASM으로 갑니다.
    return { tokenizer, model: await withDevice('wasm') };
  }
};

/**
 * 한 번만 부릅니다. Promise를 담아두면 warmup 중에 tag가 와도 같은 로딩을
 * 기다립니다 — 13.9MB를 두 번 받지 않습니다.
 */
let bundle: ReturnType<typeof loadBundle> | null = null;

const load = () => (bundle ??= loadBundle());

self.onmessage = async ({ data }: MessageEvent<Incoming>) => {
  // warmup은 응답을 기다리는 쪽이 없어서 id가 없습니다. 실패해도 조용히 넘어가고,
  // 다음 tag가 같은 로딩을 다시 기다리다 id를 붙여 에러를 받습니다.
  const id = data.type === 'tag' ? data.id : null;

  try {
    const { tokenizer, model } = await load();

    if (data.type === 'warmup') {
      post({ type: 'ready' });
      return;
    }

    const inputs = await tokenizer(data.text, { truncation: true });
    const output = await model(inputs);

    // 확률이 아니라 원본 로짓입니다. 이진 softmax는 포화돼서 0.9999와 0.999999가
    // 거의 같아 보이는데, 로짓 차이는 2배 넘게 납니다.
    post({ type: 'result', id: data.id, logits: output.logits.tolist()[0] as number[] });
  } catch (error) {
    if (id === null) return;
    post({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
  }
};
