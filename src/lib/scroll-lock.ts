"use client";

/*
  One page-scroll lock shared by everything that covers the page (quick view,
  cart sheet, filter sheet). Each holder takes a lock and gives it back; the
  page scrolls again only when the last one is returned. Before this, two
  layers saved and restored `overflow` on their own and the page could stay
  frozen after one closed over the other.
*/
let holders = 0;

export function lockScroll(): () => void {
  holders += 1;
  if (holders === 1) document.documentElement.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0) document.documentElement.style.overflow = "";
  };
}
