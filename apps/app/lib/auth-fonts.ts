import { Instrument_Serif, Red_Hat_Text } from "next/font/google"

export const authSerif = Instrument_Serif({
  weight: "400",
  style: "italic",
  subsets: ["latin"],
  variable: "--font-auth-serif",
})

export const authSans = Red_Hat_Text({
  subsets: ["latin"],
  variable: "--font-auth-sans",
})
