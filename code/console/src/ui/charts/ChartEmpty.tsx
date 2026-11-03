import "./charts.css";

export function ChartEmpty({ text }: { text: string }) {
  return <p className="chart-empty">{text}</p>;
}
