package net.exitpoint.optinix.overlay

data class MacroStep(val type: String, val durationMs: Long, val label: String)
data class MacroSpec(val id: String, val name: String, val repeats: Int, val steps: List<MacroStep>) {
  companion object {
    val actions = setOf("delay", "haptic", "marker", "pause_timer", "resume_timer", "collapse_overlay")

    fun parse(raw: Map<String, Any?>): MacroSpec {
      val name = (raw["name"] as? String)?.trim().orEmpty()
      require(name.isNotEmpty() && name.length <= 60) { "Macro name must contain 1–60 characters." }
      val repeatNumber = (raw["repeats"] as? Number)?.toDouble() ?: 1.0
      require(repeatNumber.isFinite() && repeatNumber % 1.0 == 0.0 && repeatNumber in 1.0..20.0) { "Choose 1–20 repeats." }
      val rows = raw["steps"] as? List<*> ?: emptyList<Any>()
      require(rows.isNotEmpty() && rows.size <= 30) { "Choose 1–30 steps." }
      val steps = rows.map { row ->
        val item = row as? Map<*, *> ?: throw IllegalArgumentException("Invalid step.")
        val type = item["type"] as? String ?: ""
        require(type in actions) { "Cross-app input is not supported. Unknown action: $type" }
        val duration = if (type == "delay") (item["durationMs"] as? Number)?.toDouble() ?: Double.NaN else 150.0
        require(duration.isFinite() && duration % 1.0 == 0.0 && duration in 100.0..60_000.0) { "Delays must be 100–60,000 ms." }
        val label = (item["label"] as? String) ?: ""
        if (type == "marker") require(label.isNotBlank() && label.length <= 80) { "A marker needs a label of 1–80 characters." }
        MacroStep(type, duration.toLong(), label)
      }
      require(steps.sumOf { it.durationMs } * repeatNumber.toLong() <= 600_000L) { "A macro must finish within 10 minutes." }
      return MacroSpec((raw["id"] as? String)?.take(80) ?: "utility", name, repeatNumber.toInt(), steps)
    }
  }
}
