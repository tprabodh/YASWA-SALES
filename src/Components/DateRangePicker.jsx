// src/Components/DateRangePicker.jsx
import React from 'react';

export default function DateRangePicker({
  value,           // 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'custom'
  onChangeType,    // fn: newType => void
  customRange,     // { start: Date|null, end: Date|null }
  onChangeCustom,  // fn: ({ start?, end? }) => void
}) {
  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div>
        <label className="block text-sm font-medium">Date/Period</label>
        <select
          value={value}
          onChange={e => onChangeType(e.target.value)}
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="thisWeek">This Week</option>
          <option value="thisMonth">This Month</option>
          <option value="custom">Custom…</option>
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
