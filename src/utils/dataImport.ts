import { getProblemImportTemplate } from "../api";
import type { MatrixImportProblemType } from "../types/api";

export const downloadMatrixTemplate = async (
  problemType: MatrixImportProblemType,
): Promise<void> => {
  const { blob, filename } = await getProblemImportTemplate(problemType);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
