import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReportLayoutProps {
  title: string;
  companyName: string | null;
  logoUrl: string | null;
  filename: string;
  exportHeaders: string[];
  exportRows: (string | number)[][];
  children: React.ReactNode;
}

export function ReportLayout({ title, companyName, logoUrl, filename, exportHeaders, exportRows, children }: ReportLayoutProps): JSX.Element {
  const [exporting, setExporting] = useState(false);

  function exportExcel(): void {
    setExporting(true);
    try {
      const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31));
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  function exportPdf(): void {
    setExporting(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(companyName ?? 'Motion ERP', 14, 15);
      doc.setFontSize(11);
      doc.text(title, 14, 23);
      autoTable(doc, {
        head: [exportHeaders],
        body: exportRows.map((r) => r.map((c) => String(c))),
        startY: 30,
        styles: { fontSize: 8 },
        foot: [['Motion ERP']],
        showFoot: 'lastPage',
      });
      doc.save(`${filename}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoUrl && <img src={logoUrl} alt="logo" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} style={{ height: 40, width: 40, objectFit: 'contain', borderRadius: 4 }} />}
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{companyName ?? 'Motion ERP'}</div>
            <h2 style={{ margin: '2px 0 0', fontSize: 18 }}>{title}</h2>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="filter-button" disabled={exporting} onClick={exportExcel}>Excel</button>
          <button className="filter-button" disabled={exporting} onClick={exportPdf}>PDF</button>
        </div>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
      <div style={{ padding: '10px 24px', borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
        Motion ERP
      </div>
    </div>
  );
}
