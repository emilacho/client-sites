// Tarjeta de residente · utilidades compartidas (código, ficha, nombre, número, día de Ecuador).
import { describe, expect, it } from "vitest"
import {
  ALFABETO_CODIGO,
  diaEcuador,
  esFicha,
  generarCodigo,
  generarFicha,
  limpiarCorreo,
  limpiarCumple,
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

describe("sector, correo y cumpleaños", () => {
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
  it("cumpleaños: día y mes juntos o nada; el día tiene que existir en ese mes", () => {
    expect(limpiarCumple(undefined, undefined)).toBeNull()
    expect(limpiarCumple("", "")).toBeNull()
    expect(limpiarCumple("29", "2")).toEqual({ dia: 29, mes: 2 })
    expect(limpiarCumple(31, 12)).toEqual({ dia: 31, mes: 12 })
    for (const [d, m] of [[30, 2], [31, 4], [31, 11], [0, 5], [5, 13], [5, 0], [5, ""], ["", 5], [1.5, 3], ["x", 3]]) {
      expect(limpiarCumple(d, m)).toBe("invalido")
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
