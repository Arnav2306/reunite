import React from 'react';
import { Printer, Tag } from 'lucide-react';

interface FoundItemStickerProps {
  foundId: string;
  category: string;
  className?: string;
  showPrintButton?: boolean;
}

export const FoundItemSticker: React.FC<FoundItemStickerProps> = ({
  foundId,
  category,
  className = '',
  showPrintButton = true,
}) => {
  const handlePrint = () => {
    // Open a dedicated print window with only the clean sticker
    const printWindow = window.open('', '_blank', 'width=450,height=320');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Found Sticker - ${foundId}</title>
          <style>
            @page {
              size: 4in 2.5in;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: #fff;
              color: #0f172a;
            }
            .sticker-card {
              width: 100%;
              max-width: 3.6in;
              border: 3px solid #0f172a;
              border-radius: 12px;
              padding: 18px;
              box-sizing: border-box;
              text-align: center;
            }
            .header {
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 2px;
              text-transform: uppercase;
              color: #475569;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 6px;
              margin-bottom: 12px;
            }
            .label {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #64748b;
              margin-bottom: 4px;
            }
            .id-box {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 26px;
              font-weight: 900;
              letter-spacing: 2.5px;
              color: #0f172a;
              padding: 8px 14px;
              background: #f1f5f9;
              border-radius: 8px;
              display: inline-block;
              margin-bottom: 12px;
              border: 1px solid #cbd5e1;
            }
            .category-badge {
              display: inline-block;
              font-size: 13px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
              padding: 5px 14px;
              background: #e2e8f0;
              border-radius: 6px;
              color: #0f172a;
            }
            .footer-note {
              font-size: 9px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="sticker-card">
            <div class="header">REUNITE &middot; CAMPUS CUSTODY</div>
            <div class="label">FOUND REPORT ID</div>
            <div class="id-box">${foundId}</div>
            <div>
              <span class="category-badge">${category}</span>
            </div>
            <div class="footer-note">Attach securely to physical item before custody deposit</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className={`p-4 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center space-y-3 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <Tag className="w-3 h-3 text-slate-400" />
          Physical Custody Sticker
        </span>
        <span className="text-[10px] text-slate-400 font-medium">Attach to item</span>
      </div>

      <div className="py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
          Found Reference ID
        </span>
        <span className="font-mono text-2xl font-black text-slate-900 dark:text-white tracking-widest block mt-0.5">
          {foundId}
        </span>
        <span className="inline-block mt-1 text-xs font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
          {category}
        </span>
      </div>

      {showPrintButton && (
        <button
          type="button"
          onClick={handlePrint}
          className="w-full py-2 px-3 text-xs font-bold text-slate-900 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
          Print Sticker
        </button>
      )}
    </div>
  );
};

