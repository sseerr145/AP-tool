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
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Extracted Data</h2>
        </div>
        <span className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-blue-200">
          {fields.length} fields
        </span>
      </div>

      {/* Enhanced Summary Stats */}
      {fields.length > 0 && (
        <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 shadow-sm">
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="text-center">
              <div className="text-blue-600 font-medium mb-1">Total Fields</div>
              <div className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{fields.length}</div>
            </div>
            <div className="text-center">
              <div className="text-blue-600 font-medium mb-1">Avg. Confidence</div>
              <div className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {Math.round(fields.reduce((acc, f) => acc + f.confidence, 0) / fields.length)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Structured Fields */}
      {structuredFields.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              🎯 Smart Invoice Data
            </h3>
          </div>
          <div className="space-y-3">
            {structuredFields.map((field, idx) => {
              const globalIdx = fields.indexOf(field);
              return (
                <div
                  key={globalIdx}
                  className={`p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
                    fieldTypeColors[field.type] || fieldTypeColors.text
                  } ${selectedIndex === globalIdx ? 'ring-2 ring-blue-500 border-blue-300 shadow-lg scale-105' : ''}`}
                  onClick={() => handleClick(field, globalIdx)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {fieldTypeIcons[field.type] || fieldTypeIcons.text}
                      <span className="text-sm font-semibold text-gray-700">
                        {field.label}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 bg-gradient-to-r from-blue-100 to-indigo-100 px-3 py-1.5 rounded-full border border-blue-200">
                      {field.confidence}% confidence
                    </span>
                  </div>
                  <div className="space-y-2">
                    <input
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all duration-300 font-medium"
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
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-6 bg-gradient-to-b from-gray-400 to-gray-600 rounded-full"></div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              📄 Additional Text ({textFields.length})
            </h3>
          </div>
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

      {/* Enhanced Export Button */}
      {fields.length > 0 && (
        <button
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 px-6 rounded-2xl transition-all duration-300 font-bold flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:scale-105 transform"
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