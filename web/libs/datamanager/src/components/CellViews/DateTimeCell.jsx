import { isValid } from "date-fns";
import { formatTableDateTime } from "../../utils/dateFnsLocale";

/** @deprecated Use formatTableDateTime from dateFnsLocale; kept for imports expecting English pattern name. */
export const dateTimeFormat = "MMM dd yyyy, HH:mm:ss";

export const DateTimeCell = (column) => {
  const date = new Date(column.value);

  return column.value ? (
    <div style={{ whiteSpace: "nowrap" }}>{isValid(date) ? formatTableDateTime(date) : ""}</div>
  ) : (
    ""
  );
};

DateTimeCell.displayType = false;
