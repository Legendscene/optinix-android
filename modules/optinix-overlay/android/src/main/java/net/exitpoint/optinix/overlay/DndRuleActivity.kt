package net.exitpoint.optinix.overlay

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class DndRuleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val column = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(32, 64, 32, 32)
    }
    column.addView(TextView(this).apply {
      text = "Optinix gaming DND\n\nThis rule limits interruptions during a session you start. Alarms and media are allowed. Other Android DND rules remain under your control."
      textSize = 18f
    })
    column.addView(Button(this).apply {
      text = "Release Optinix rule"
      setOnClickListener { DndController(this@DndRuleActivity).set(false); finish() }
    })
    column.addView(Button(this).apply { text = "Done"; setOnClickListener { finish() } })
    setContentView(column)
  }
}
