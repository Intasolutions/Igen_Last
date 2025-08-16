const DateRangePicker = ({ value, onChange }) => {
  return (
    <div className="flex gap-2 items-center">
      <input
        type="date"
        value={value.from || ''}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-md"
      />
      <input
        type="date"
        value={value.to || ''}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-md"
      />
    </div>
  );
};

export default DateRangePicker;
