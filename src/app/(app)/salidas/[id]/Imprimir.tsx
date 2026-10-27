"use client";

export default function Imprimir() {
  return <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}>Imprimir registro</button>;
}
