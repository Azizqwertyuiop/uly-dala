"use client";

import dynamic from "next/dynamic";

/** three.js только на клиенте и только на этой служебной странице. */
export const RenderTestClient = dynamic(() => import("./RenderTest"), { ssr: false });
