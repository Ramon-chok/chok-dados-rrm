import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { FileSpreadsheet, Check, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface ExcelSheetData {
  sheetName: string;
  data: Record<string, any>[];
}

interface ExportExcelButtonProps {
  filename?: string;
  sheets?: ExcelSheetData[];
  onPrepareData?: () => ExcelSheetData[] | Promise<ExcelSheetData[]>;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
}

export const ExportExcelButton: React.FC<ExportExcelButtonProps> = ({
  filename = 'Relatorio_Chok.xlsx',
  sheets,
  onPrepareData,
  label = 'Exportar Excel',
  compact = false,
  disabled = false,
}) => {
  const { t } = useTheme();
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    if (disabled || exporting) return;
    setExporting(true);

    try {
      let resolvedSheets: ExcelSheetData[] = [];
      if (onPrepareData) {
        resolvedSheets = await onPrepareData();
      } else if (sheets) {
        resolvedSheets = sheets;
      }

      if (!resolvedSheets || resolvedSheets.length === 0) {
        setExporting(false);
        return;
      }

      const wb = XLSX.utils.book_new();

      resolvedSheets.forEach((s) => {
        // Sanitize sheet name (max 31 chars, no invalid characters)
        const cleanName = (s.sheetName || 'Sheet')
          .replace(/[\\/?*[\]:]/g, ' ')
          .substring(0, 31);
        const ws = XLSX.utils.json_to_sheet(s.data);
        XLSX.utils.book_append_sheet(wb, ws, cleanName);
      });

      const exportFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
      XLSX.writeFile(wb, exportFilename);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      console.error('Falha ao exportar arquivo Excel:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || exporting}
      title="Baixar planilha formatada em formato Microsoft Excel (.xlsx)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: compact ? '6px 12px' : '8px 14px',
        borderRadius: '8px',
        border: `1px solid ${success ? '#3DD68C' : t.border}`,
        background: success ? 'rgba(61, 214, 140, 0.1)' : t.surface,
        color: success ? '#3DD68C' : t.textSecondary,
        fontSize: '13px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {success ? (
        <>
          <Check size={15} color="#3DD68C" />
          <span>{compact ? 'Baixado' : 'Planilha Gerada'}</span>
        </>
      ) : exporting ? (
        <>
          <Download size={15} className="animate-bounce" color={t.primary} />
          <span>Gerando...</span>
        </>
      ) : (
        <>
          <FileSpreadsheet size={15} color={t.textSecondary} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
