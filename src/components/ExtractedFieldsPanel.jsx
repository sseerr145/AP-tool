import { useState } from "react";

export default function ExtractedFieldsPanel({ fields, onFieldClick, onFieldUpdate }) {
  const [selectedIndex, setSelectedIndex] = useState(null);

  const fieldTypeColors = {
    invoiceNumber: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    date: 'bg-green-50 border-green-200 hover:bg-green-100',
    total: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    subtotal: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
    tax: 'bg-red-50 border-red-200 hover:bg-red-100',
    customer: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
    vendor: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    text: 'bg-gray-50 border-gray-200 hover:bg-gray-100'
  };

  const fieldTypeIcons = {
    invoiceNumber: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    date: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    total: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    ),
    text: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    )
  };

  const handleClick = (field, idx) => {
    setSelectedIndex(selectedIndex === idx ? null : idx);
    onFieldClick(field);
  };

  const structuredFields = fields.filter(f => f.type !== 'text');
  const textFields = fields.filter(f => f.type === 'text');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Extracted Fields</h2>
        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {fields.length} fields
        </span>
      </div>

      {/* Summary Stats */}
      {fields.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Fields</div>
              <div className="font-semibold text-lg text-gray-900">{fields.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Avg. Confidence</div>
              <div className="font-semibold text-lg text-gray-900">
                {Math.round(fields.reduce((acc, f) => acc + f.confidence, 0) / fields.length)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Structured Fields */}
      {structuredFields.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">
            Invoice Data
          </h3>
          <div className="space-y-3">
            {structuredFields.map((field, idx) => {
              const globalIdx = fields.indexOf(field);
              return (
                <div
                  key={globalIdx}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    fieldTypeColors[field.type] || fieldTypeColors.text
                  } ${selectedIndex === globalIdx ? 'ring-2 ring-blue-500 border-blue-300' : ''}`}
                  onClick={() => handleClick(field, globalIdx)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {fieldTypeIcons[field.type] || fieldTypeIcons.text}
                      <span className="text-sm font-semibold text-gray-700">
                        {field.label}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                      {field.confidence}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    <input
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={field.value || field.name}
                      onChange={(e) => onFieldUpdate(globalIdx, { ...field, value: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Extracted value"
                    />
                    {field.name !== field.value && (
                      <div className="text-xs text-gray-500 truncate bg-gray-100 px-2 py-1 rounded" title={field.name}>
                        Raw: {field.name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Text Fields */}
      {textFields.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">
            Additional Text ({textFields.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {textFields.slice(0, 10).map((field, idx) => {
              const globalIdx = fields.indexOf(field);
              return (
                <div
                  key={globalIdx}
                  className={`p-3 border rounded-md cursor-pointer transition-all text-sm ${
                    fieldTypeColors.text
                  } ${selectedIndex === globalIdx ? 'ring-2 ring-blue-500 border-blue-300' : ''}`}
                  onClick={() => handleClick(field, globalIdx)}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{field.value}</span>
                    <span className="text-xs text-gray-500 ml-2">{field.confidence}%</span>
                  </div>
                </div>
              );
            })}
            {textFields.length > 10 && (
              <div className="text-xs text-gray-500 text-center py-2">
                ... and {textFields.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Button */}
      {fields.length > 0 && (
        <button
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
          onClick={() => {
            const exportData = {
              invoice: {},
              extraction_metadata: {
                total_fields: fields.length,
                extraction_date: new Date().toISOString(),
                average_confidence: Math.round(fields.reduce((acc, f) => acc + f.confidence, 0) / fields.length)
              }
            };

            // Structured fields
            structuredFields.forEach(field => {
              exportData.invoice[field.type] = {
                value: field.value || field.name,
                confidence: field.confidence
              };
            });

            // Additional text
            if (textFields.length > 0) {
              exportData.additional_text = textFields.map(field => ({
                text: field.value,
                confidence: field.confidence
              }));
            }

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice-data-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export Invoice Data
        </button>
      )}
    </div>
  );
}