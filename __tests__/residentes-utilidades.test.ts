// Tarjeta de residente · utilidades compartidas (código, ficha, nombre, número, día de Ecuador).
import { describe, expect, it } from "vitest"
import {
  ALFABETO_CODIGO,
  diaEcuador,
  esFicha,
  generarCodigo,
  generarFicha,
  limpiarCorreo,
  limpiarCedula,
  limpiarFechaNacimiento,
  limpiarNombre,
  limpiarSector,
  normalizarCodigo,
  numeroVisible,
} from "@/lib/residentes"

describe("el código que da Emilio", () => {
  it("el alfabeto no trae letras que se confunden", () => {
    for (const x of ["0", "O", "1", "I", "L"]) expect(ALFABETO_CODIGO).not.toContain(x)
    expect(new Set(ALFABETO_CODIGO).size).toBe(ALFABETO_CODIGO.length)
  })
  it("acepta lo que escribe la persona: minúsculas, espacios, guiones, con o sin «NAU»", () => {
    expect(normalizarCodigo("NAU-7K3Q2X")).toBe("NAU-7K3Q2X")
    expect(normalizarCodigo("nau-7k3q2x")).toBe("NAU-7K3Q2X")
    expect(normalizarCodigo(" 7k3 q2x ")).toBe("NAU-7K3Q2X")
    expect(normalizarCodigo("NAU 7K3Q2X")).toBe("NAU-7K3Q2X")
  })
  it("rechaza lo que no puede ser un código", () => {
    for (const x of ["", "NAU-7K3Q", "NAU-7K3Q2XY", "NAU-OOOOOO", "NAU-11111L", null, 123, undefined]) {
      expect(normalizarCodigo(x)).toBeNull()
    }
  })
  it("los códigos nuevos tienen el formato y pasan por la normalización sin cambiar", () => {
    const vistos = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const c = generarCodigo()
      expect(c).toMatch(/^NAU-[2-9A-HJKMNP-Z]{6}$/)
      expect(normalizarCodigo(c)).toBe(c)
      vistos.add(c)
    }
    expect(vistos.size).toBeGreaterThan(495)
  })
})

describe("la ficha del QR", () => {
  it("24 caracteres seguros para una dirección, al azar", () => {
    const a = generarFicha(), b = generarFicha()
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/)
    expect(a).not.toBe(b)
    expect(esFicha(a)).toBe(true)
  })
  it("esFicha no deja pasar nada raro", () => {
    for (const x of ["", "corta", "x".repeat(25), "a/b".padEnd(24, "x"), "../".padEnd(24, "x"), null, 5]) expect(esFicha(x)).toBe(false)
  })
})

describe("nombre y número", () => {
  it("limpia espacios y exige de 2 a 60 letras", () => {
    expect(limpiarNombre("  María   Rodríguez ")).toBe("María Rodríguez")
    expect(limpiarNombre("A")).toBeNull()
    expect(limpiarNombre("x".repeat(61))).toBeNull()
    expect(limpiarNombre(42)).toBeNull()
  })
  it("el número se muestra como R-0007", () => {
    expect(numeroVisible(7)).toBe("R-0007")
    expect(numeroVisible(427)).toBe("R-0427")
    expect(numeroVisible(12345)).toBe("R-12345")
  })
})

describe("sector, correo, cédula y fecha de nacimiento", () => {
  it("el sector es obligatorio y se limpia como el nombre", () => {
    expect(limpiarSector("  La   Playa ")).toBe("La Playa")
    expect(limpiarSector("")).toBeNull()
    expect(limpiarSector(undefined)).toBeNull()
  })
  it("correo opcional: vacío vale, mal escrito no", () => {
    expect(limpiarCorreo(undefined)).toBeNull()
    expect(limpiarCorreo("   ")).toBeNull()
    expect(limpiarCorreo(" Ana@Mail.COM ")).toBe("ana@mail.com")
    expect(limpiarCorreo("ana@mail")).toBe("invalido")
    expect(limpiarCorreo("a b@c.d")).toBe("invalido")
    expect(limpiarCorreo(`${"x".repeat(115)}@m.com`)).toBe("invalido")
    expect(limpiarCorreo(5)).toBe("invalido")
  })
  it("cédula obligatoria: solo números, de 6 a 15, sin espacios ni guiones; no se valida el dígito verificador", () => {
    expect(limpiarCedula(" 0912-345 678 ")).toBe("0912345678")
    expect(limpiarCedula("123456")).toBe("123456")
    expect(limpiarCedula("1".repeat(15))).toBe("1".repeat(15))
    for (const x of ["", "12345", "1".repeat(16), "AB123456", "0912.345.678", undefined, null, 912345678]) {
      expect(limpiarCedula(x)).toBeNull()
    }
  })
  it("fecha de nacimiento: día, mes y año juntos o nada; tiene que existir, desde 1900 y no en el futuro (Ecuador)", () => {
    const hoy = new Date("2026-11-13T03:00:00Z") // en Ecuador todavía es 12-nov
    expect(limpiarFechaNacimiento(undefined, undefined, undefined, hoy)).toBeNull()
    expect(limpiarFechaNacimiento("", "", "", hoy)).toBeNull()
    expect(limpiarFechaNacimiento("29", "2", "2000", hoy)).toBe("2000-02-29")
    expect(limpiarFechaNacimiento(1, 1, 1900, hoy)).toBe("1900-01-01")
    expect(limpiarFechaNacimiento(12, 11, 2026, hoy)).toBe("2026-11-12")
    for (const [d, m, a] of [[29, 2, 2001], [31, 4, 1990], [13, 11, 2026], [1, 1, 1899], [5, 3, ""], ["", 3, 1990], [0, 5, 1990], [5, 13, 1990], [1.5, 3, 1990], ["x", 3, 1990]]) {
      expect(limpiarFechaNacimiento(d, m, a, hoy)).toBe("invalido")
    }
  })
})

describe("el día de Ecuador (vale una vez al día)", () => {
  it("cambia a medianoche de Guayaquil (UTC-5), no a medianoche UTC", () => {
    expect(diaEcuador(new Date("2026-11-13T04:59:59Z"))).toBe("2026-11-12")
    expect(diaEcuador(new Date("2026-11-13T05:00:00Z"))).toBe("2026-11-13")
    expect(diaEcuador(new Date("2026-11-13T00:30:00Z"))).toBe("2026-11-12")
  })
})
