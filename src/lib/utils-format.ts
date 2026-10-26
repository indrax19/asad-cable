export const fmtPKR = (n: number | undefined | null) =>
  `Rs ${Number(n ?? 0).toLocaleString("en-PK")}`;

export const fmtDate = (ts: number | undefined | null) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Human-readable date+time used as a denormalized text field in Firestore.
// Example: "May 23, 2026 05:03:32 PM"
export const fmtDateTimeText = (ts: number | undefined | null) => {
  if (!ts) return "";
  const d = new Date(ts);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${date} ${time}`;
};

export const fmtCNIC = (cnic: string | undefined | null) => {
  if (!cnic) return "—";
  const clean = cnic.replace(/\D/g, "");
  if (clean.length !== 13) return cnic;
  return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12)}`;
};

export const fmtPhone = (phone: string | undefined | null) => {
  if (!phone) return "—";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 10 && clean.startsWith("3")) {
    return `+92 ${clean.slice(0, 3)} ${clean.slice(3)}`;
  }
  if (clean.length === 11 && clean.startsWith("03")) {
    return `+92 ${clean.slice(1, 4)} ${clean.slice(4)}`;
  }
  if (clean.length === 12 && clean.startsWith("923")) {
    return `+92 ${clean.slice(2, 5)} ${clean.slice(5)}`;
  }
  return phone;
};
