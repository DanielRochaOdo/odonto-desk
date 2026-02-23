const STATUS_STYLES = {
  pending: "bg-white/10 text-mist/80",
  active: "bg-teal/20 text-teal",
  ended: "bg-white/5 text-mist/60",
  denied: "bg-coral/20 text-coral",
};

export default function SessionStatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return <span className={`badge ${style}`}>{status}</span>;
}
