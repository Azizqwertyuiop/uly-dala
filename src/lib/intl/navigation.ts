import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Ссылки и переходы с учётом языка. Используйте вместо next/link и next/navigation. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
