import { signal } from "https://raw.githubusercontent.com/mini-jail/signals/main/mod.ts"
import { addElement, addEvent, addText, component, render } from "./mod.ts"

const Button = component(() => {
  const text = signal("hello world")

  addElement("button", () => {
    addEvent("click", () => text(prompt("new text")!))

    if (text() === "cool") {
      addText("sehr cool")
    }

    addElement("p", () => {
      addText(text())
    })

    addElement("p", (attr) => {
      attr.textContent = "LETZTER :D"
    })
  })
})

render(document.body, () => {
  Button()
})
