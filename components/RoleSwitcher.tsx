"use client";

import React from "react";
import { ROLE_LABELS, UserRole } from "@/lib/permissions";

interface RoleSwitcherProps {
  role: UserRole;
  onChangeRole: (nextRole: UserRole) => void;
}

export default function RoleSwitcher({ role, onChangeRole }: RoleSwitcherProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 bg-gray-900/90 border border-gray-700 rounded-xl px-3 py-2 text-xs"
      dir="rtl"
    >
      <span className="text-gray-400">
        תפקיד פעיל: <strong className="text-cyan-300">{ROLE_LABELS[role]}</strong>
      </span>
      <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-lg border border-gray-700">
        <button
          type="button"
          onClick={() => onChangeRole("manager")}
          className={
            role === "manager"
              ? "px-2.5 py-1 rounded-md font-bold bg-cyan-600 text-white cursor-pointer"
              : "px-2.5 py-1 rounded-md text-gray-300 hover:text-white cursor-pointer"
          }
        >
          מנהל / מוקדן
        </button>
        <button
          type="button"
          onClick={() => onChangeRole("technician")}
          className={
            role === "technician"
              ? "px-2.5 py-1 rounded-md font-bold bg-amber-500 text-gray-950 cursor-pointer"
              : "px-2.5 py-1 rounded-md text-gray-300 hover:text-white cursor-pointer"
          }
        >
          טכנאי שטח
        </button>
      </div>
    </div>
  );
}