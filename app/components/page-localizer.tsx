"use client";

import { useEffect, useRef } from "react";
import { translateInterfaceText } from "../lib/full-i18n";
import type { LocaleCode } from "../lib/i18n";

type SavedText = { source: string; rendered: string };
type SavedAttribute = { source: string; rendered: string };
const translatedAttributes = ["aria-label", "title", "placeholder"] as const;

export default function PageLocalizer({ locale }: { locale: LocaleCode }) {
  const saved = useRef(new WeakMap<Text, SavedText>());
  const savedAttributes = useRef(
    new WeakMap<Element, Map<string, SavedAttribute>>(),
  );

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      ".application, .onboarding, .boot-screen",
    );
    if (!root) return;
    let translating = false;

    const translateTree = (scope: Node) => {
      translating = true;
      const nodes: Text[] = [];
      if (scope.nodeType === Node.TEXT_NODE) {
        nodes.push(scope as Text);
      } else {
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      }
      for (const node of nodes) {
        const current = node.nodeValue ?? "";
        const previous = saved.current.get(node);
        const source =
          previous && current === previous.rendered ? previous.source : current;
        const rendered = translateInterfaceText(locale, source);
        saved.current.set(node, { source, rendered });
        if (current !== rendered) node.nodeValue = rendered;
      }

      const elements: Element[] = [];
      if (scope.nodeType === Node.ELEMENT_NODE) elements.push(scope as Element);
      if ("querySelectorAll" in scope) {
        elements.push(...(scope as Element).querySelectorAll("*"));
      }
      for (const element of elements) {
        const stored =
          savedAttributes.current.get(element) ??
          new Map<string, SavedAttribute>();
        for (const attribute of translatedAttributes) {
          const current = element.getAttribute(attribute);
          if (!current) continue;
          const previous = stored.get(attribute);
          const source =
            previous && current === previous.rendered
              ? previous.source
              : current;
          const rendered = translateInterfaceText(locale, source);
          stored.set(attribute, { source, rendered });
          if (current !== rendered) element.setAttribute(attribute, rendered);
        }
        savedAttributes.current.set(element, stored);
      }
      translating = false;
    };

    translateTree(root);
    const observer = new MutationObserver((changes) => {
      if (translating) return;
      observer.disconnect();
      for (const change of changes) {
        if (change.type === "characterData") translateTree(change.target);
        for (const node of change.addedNodes) translateTree(node);
      }
      observer.observe(root, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
    observer.observe(root, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [locale]);

  return null;
}
