import { useState } from "react";

export default function ExtractedFieldsPanel({ fields, onFieldClick, onFieldUpdate }) {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Extracted Fields</h2>
      <ul className="space-y-4">
        {fields.map((field, idx) => (
          <li
            key={idx}
            className="p-2 bg-white shadow border rounded cursor-pointer hover:bg-gray-50"
            onClick={() => onFieldClick(field)}
          >
            <label className="block text-sm font-medium text-gray-700">Field Label</label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={field.label || field.name}
              onChange={(e) => onFieldUpdate(idx, { ...field, label: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
            <label className="block text-sm mt-2 font-medium text-gray-700">Raw OCR Text</label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={field.name}
              onChange={(e) => onFieldUpdate(idx, { ...field, name: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}