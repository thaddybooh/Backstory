declare namespace App {
  interface Locals {
    /** Photo credits gathered while a page renders, listed at the bottom of the page by Base.astro. */
    photoCredits?: import('./components/Credit.astro').PhotoCredit[];
  }
}
