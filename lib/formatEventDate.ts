const formatEventDate = (isoString: string) => {
  const eventDate = new Date(isoString);

  const year = eventDate.getFullYear();
  const month = eventDate.getMonth() + 1;
  const day = eventDate.getDate();

  return `${year}. ${month.toString().padStart(2, '0')}. ${day.toString().padStart(2, '0')}`;
};

export default formatEventDate;
