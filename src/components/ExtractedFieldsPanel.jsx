import { useState } from "react";

export default function ExtractedFieldsPanel({ fields, onFieldClick, onFieldUpdate }) {
  const [selectedIndex, setSelectedIndex] = useState(null);

  const fieldTypeColors = {
    invoiceNumber: 'bg-blue-100 border-blue-300',
    date: 'bg-green-100 border-green-300',
    total: 'bg-purple-100 border-purple-300',
    subtotal: 'bg-indigo-100 border-indigo-300',
    tax: 'bg-red-100 border-red-300',
    customer: 'bg-yellow-100 border-yellow-300',
    vendor: 'bg-orange-100 border-orange-300',
    text: 'bg-gray-100 border-gray-300'
  };

  const handleClick = (field, idx) => {
    setSelectedIndex(idx);
    onFieldClick(field);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Extracted Fields</h2>
      
      {/* Summary Stats */}
      <div className="mb-4 p-3 bg-white rounded-lg shadow-sm">
        <div className="text-sm text-gray-600">
          Total fields extracted: <span className="font-semibold">{fields.length}</span>
        </div>
        <div className="text-sm text-gray-600">
          Average confidence: <span className="font-semibold">
            {Math.round(fields.reduce((acc, f) => acc + f.confidence, 0) / fields.length)}%
          </span>
        </div>
      </div>

      <ul className="space-y-3">
        {fields.map((field, idx) => (
          <li
            key={idx}
            className={`p-3 shadow border rounded-lg cursor-pointer transition-all ${
              fieldTypeColors[field.type] || fieldTypeColors.text
            } ${selectedIndex === idx ? 'ring-2 ring-blue-500' : ''} hover:shadow-md`}
            onClick={() => handleClick(field, idx)}
          >
            {/* Field Type Badge */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                {field.type}
              </span>
              <span className="text-xs text-gray-500">
                {field.confidence}% confidence
              </span>
            </div>

            {/* Field Label */}
            <div className="mb-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Field Label
              </label>
              <input
                className="w-full border rounded px-2 py-1 text-sm bg-white"
                value={field.label || field.name}
                onChange={(e) => onFieldUpdate(idx, { ...field, label: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Enter field label"
              />
            </div>

            {/* Field Value */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Extracted Value
              </label>
              <input
                className="w-full border rounded px-2 py-1 text-sm bg-white"
                value={field.value || field.name}
                onChange={(e) => onFieldUpdate(idx, { ...field, value: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Extracted value"
              />
            </div>

            {/* Show raw text on hover */}
            <div className="mt-1 text-xs text-gray-500 truncate" title={field.name}>
              Raw: {field.name}
            </div>
          </li>
        ))}
      </ul>

      {/* Export Button */}
      {fields.length > 0 && (
        <button
          className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded transition-colors"
          onClick={() => {
            const exportData = fields.reduce((acc, field) => {
              acc[field.label || field.type] = field.value || field.name;
              return acc;
            }, {});
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'invoice-data.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export as JSON
        </button>
      )}
    </div>
  );
}