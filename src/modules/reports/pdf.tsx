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

// Mirrors the on-screen report: cream page, each section a white rounded card.
const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#2b3a44",
    backgroundColor: "#f5f3ed", // brand cream canvas
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1 solid #e4ded1",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logo: { height: 34, objectFit: "contain" },
  supplierName: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  metaRight: { textAlign: "right" },
  docTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  metaLine: { fontSize: 9, marginBottom: 2 },
  metaKey: { color: "#9aa0a3" },
  groupHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  groupName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  groupSub: { fontSize: 9, color: "#5a6b75" },
  th: {
    flexDirection: "row",
    borderTop: "1 solid #e4ded1",
    borderBottom: "1 solid #e4ded1",
    paddingVertical: 4,
    fontSize: 7,
    color: "#8a8f92",
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    borderBottom: "0.5 solid #efeadf",
    paddingVertical: 4,
  },
  nonBillable: { color: "#9aa0a3" },
  subtotal: {
    flexDirection: "row",
    borderTop: "1 solid #d3cdbf",
    paddingTop: 5,
    marginTop: 3,
    fontFamily: "Helvetica-Bold",
  },
  cDate: { width: "20%" },
  cHours: { width: "12%" },
  cDesc: { width: "48%" },
  cCost: { width: "20%", textAlign: "right" },
  totalCard: {
    backgroundColor: "#ffffff",
    border: "1 solid #e4ded1",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalText: { fontSize: 12, fontFamily: "Helvetica-Bold" },
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
        <View style={[styles.card, styles.header]}>
          <View>
            {meta.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={meta.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.supplierName}>{meta.firmName}</Text>
            )}
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.docTitle}>{meta.labels.title}</Text>
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

        {result.groups.map((g) => (
          <View key={g.projectId} style={styles.card} wrap={false}>
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
                  {!r.billable ? (
                    <Text style={styles.nonBillable}>
                      {" "}
                      ({meta.labels.nonBillable})
                    </Text>
                  ) : null}
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

        <View style={styles.totalCard} wrap={false}>
          <Text style={styles.totalText}>{meta.labels.total}</Text>
          <Text style={styles.totalText}>
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
