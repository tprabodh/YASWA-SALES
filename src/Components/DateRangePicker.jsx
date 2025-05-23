// src/Components/DateRangePicker.jsx
import React from 'react';

export default function DateRangePicker({
  value,           // 'today' | 'last7' | 'last30' | 'custom' | 'allTime'
  onChangeType,    // fn: newType => void
  customRange,     // { start: Date|null, end: Date|null }
  onChangeCustom,  // fn: ({ start?, end? }) => void
}) {
  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div>
        <label className="block text-sm font-medium">Range</label>
        <select
          value={value}
          onChange={e => onChangeType(e.target.value)}
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
        >
          <option value="today">Today</option>
          <option value="last7">Last 7 days</option>
          <option value="last30">Last 30 days</option>
          <option value="custom">Custom</option>
          <option value="allTime">All Time</option>
        </select>
      </div>

      {value === 'custom' && (
        <>
          <div>
            <label className="block text-sm">Start</label>
            <input
              type="date"
              value={customRange.start?.toISOString().slice(0,10) || ''}
              onChange={e =>
                onChangeCustom({ start: e.target.value ? new Date(e.target.value) : null })
              }
              className="mt-1 block border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm">End</label>
            <input
              type="date"
              value={customRange.end?.toISOString().slice(0,10) || ''}
              onChange={e =>
                onChangeCustom({ end: e.target.value ? new Date(e.target.value) : null })
              }
              className="mt-1 block border-gray-300 rounded-md shadow-sm"
            />
          </div>
        </>
      )}
    </div>
  );
}
