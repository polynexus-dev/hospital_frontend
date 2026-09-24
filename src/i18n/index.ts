import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "./en"
import mr from "./mr"
import hi from "./hi"

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    mr: { translation: mr },
    hi: { translation: hi },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})


export default i18n
