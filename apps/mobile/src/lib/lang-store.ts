import { useEffect, useState } from "react";
import { Lang } from "./i18n";

let currentLang: Lang = "en";
const subscribers = new Set<(l: Lang) => void>();

export function setLang(l: Lang) {
  currentLang = l;
  subscribers.forEach((cb) => cb(l));
}

export function getLang(): Lang {
  return currentLang;
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLocal] = useState(currentLang);
  useEffect(() => {
    const cb = (l: Lang) => setLocal(l);
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
  }, []);
  return [lang, setLang];
}
