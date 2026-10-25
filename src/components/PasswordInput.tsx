"use client";

import { useState } from "react";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  placeholder?: string;
  required?: boolean;
}

export default function PasswordInput({ label, value, onChange, minLength, placeholder, required = true }: Props) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded px-3 py-2 pr-16 bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          placeholder={placeholder || (minLength ? `Min ${minLength} characters` : "")}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
