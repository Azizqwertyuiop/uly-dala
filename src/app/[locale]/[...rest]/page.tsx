import { notFound } from "next/navigation";

// Любой неизвестный адрес внутри языка (/ru/что-угодно) → наша 404 с хедером и футером.
export default function CatchAll() {
  notFound();
}
