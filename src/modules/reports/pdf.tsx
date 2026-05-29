import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { minutesToHours } from "@/modules/time/display";
import type { TimesheetResult } from "./types";

export type TimesheetPdfLabels = {
  title: string;
  supplier: string;
  client: string;
  period: string;
  date: string;
  hours: string;
  description: string;
  cost: string;
  subtotal: string;
  total: string;
  nonBillable: string;
};

export type TimesheetPdfMeta = {
  firmName: string;
  logoUrl?: string;
  clientName: string;
  from: string;
  to: string;
  locale: string;
  labels: TimesheetPdfLabels;
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#171717",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "1 solid #e5e5e5",
  },
  logo: { height: 36, marginBottom: 6, objectFit: "contain" },
  supplierLabel: {
    fontSize: 7,
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  supplierName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  metaRight: { textAlign: "right" },
  metaLine: { fontSize: 9, marginBottom: 2 },
  metaKey: { color: "#999999" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 14 },
  group: { marginBottom: 14 },
  groupHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  groupName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  groupSub: { fontSize: 9, color: "#666666" },
  th: {
    flexDirection: "row",
    borderBottom: "1 solid #cccccc",
    paddingVertical: 4,
    fontSize: 7,
    color: "#999999",
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    borderBottom: "0.5 solid #eeeeee",
    paddingVertical: 3,
  },
  subtotal: {
    flexDirection: "row",
    borderTop: "1 solid #cccccc",
    paddingTop: 4,
    marginTop: 2,
    fontFamily: "Helvetica-Bold",
  },
  cDate: { width: "20%" },
  cHours: { width: "12%" },
  cDesc: { width: "48%" },
  cCost: { width: "20%", textAlign: "right" },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 8,
    borderTop: "2 solid #171717",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
});

function TimesheetDocument({
  result,
  meta,
}: {
  result: TimesheetResult;
  meta: TimesheetPdfMeta;
}) {
  const numFmt = new Intl.NumberFormat(meta.locale, {
    maximumFractionDigits: 2,
  });
  const dateFmt = new Intl.DateTimeFormat(meta.locale, { dateStyle: "medium" });
  const money = (amount: number, currency: string | null) =>
    `${numFmt.format(amount)}${currency ? ` ${currency}` : ""}`;

  const totalsText = Object.entries(result.totalsByCurrency)
    .map(([cur, amt]) => money(amt, cur || null))
    .join("   ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {meta.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={meta.logoUrl} style={styles.logo} />
            ) : null}
            <Text style={styles.supplierLabel}>{meta.labels.supplier}</Text>
            <Text style={styles.supplierName}>{meta.firmName}</Text>
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.metaLine}>
              <Text style={styles.metaKey}>{meta.labels.client}: </Text>
              {meta.clientName}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaKey}>{meta.labels.period}: </Text>
              {dateFmt.format(new Date(meta.from))} –{" "}
              {dateFmt.format(new Date(meta.to))}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{meta.labels.title}</Text>

        {result.groups.map((g) => (
          <View key={g.projectId} style={styles.group} wrap={false}>
            <View style={styles.groupHead}>
              <Text style={styles.groupName}>{g.projectName ?? "—"}</Text>
              <Text style={styles.groupSub}>
                {minutesToHours(g.subtotalMinutes)} h ·{" "}
                {money(g.subtotalAmount, g.currency)}
              </Text>
            </View>
            <View style={styles.th}>
              <Text style={styles.cDate}>{meta.labels.date}</Text>
              <Text style={styles.cHours}>{meta.labels.hours}</Text>
              <Text style={styles.cDesc}>{meta.labels.description}</Text>
              <Text style={styles.cCost}>{meta.labels.cost}</Text>
            </View>
            {g.rows.map((r, i) => (
              <View key={`${g.projectId}-${i}`} style={styles.row}>
                <Text style={styles.cDate}>
                  {dateFmt.format(new Date(r.date))}
                </Text>
                <Text style={styles.cHours}>{minutesToHours(r.minutes)}</Text>
                <Text style={styles.cDesc}>
                  {r.description ?? "—"}
                  {!r.billable ? ` (${meta.labels.nonBillable})` : ""}
                </Text>
                <Text style={styles.cCost}>
                  {r.billable && r.amount != null
                    ? money(r.amount, g.currency)
                    : "—"}
                </Text>
              </View>
            ))}
            <View style={styles.subtotal}>
              <Text style={styles.cDate}>{meta.labels.subtotal}</Text>
              <Text style={styles.cHours}>{minutesToHours(g.subtotalMinutes)}</Text>
              <Text style={styles.cDesc}> </Text>
              <Text style={styles.cCost}>
                {money(g.subtotalAmount, g.currency)}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.total}>
          <Text>{meta.labels.total}</Text>
          <Text>
            {minutesToHours(result.totalMinutes)} h
            {totalsText ? `   ${totalsText}` : ""}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderTimesheetPdf(
  result: TimesheetResult,
  meta: TimesheetPdfMeta,
): Promise<Buffer> {
  return renderToBuffer(<TimesheetDocument result={result} meta={meta} />);
}
