from __future__ import annotations

from typing import Any, Dict, List

import matplotlib.pyplot as plt


class ChartRenderer:
    def __init__(self):
        self.figure = None

    def render(self, chart_spec: Dict[str, Any]) -> None:
        if not chart_spec:
            return
        spec = chart_spec
        chart_type = (spec.get("type") or "").lower()
        title = spec.get("title", "Chart")
        x_label = spec.get("x_label")
        y_label = spec.get("y_label")
        data = spec.get("data")

        if not data:
            return

        if self.figure:
            plt.close(self.figure)
        self.figure = plt.figure(figsize=(7, 4.5))
        ax = self.figure.add_subplot(111)

        if chart_type == "bar":
            labels = list(data.keys())
            values = list(data.values())
            ax.bar(labels, values, color="#4f81bd")
        elif chart_type == "line":
            if isinstance(data, dict):
                labels = list(data.keys())
                values = list(data.values())
            else:
                labels = [item.get("x") for item in data]
                values = [item.get("y") for item in data]
            ax.plot(labels, values, marker="o", color="#c0504d")
        elif chart_type == "scatter":
            xs = [item.get("x") for item in data]
            ys = [item.get("y") for item in data]
            ax.scatter(xs, ys, color="#9bbb59")
        elif chart_type == "table":
            ax.axis("off")
            headers = list(data[0].keys())
            rows = [[row.get(h, "") for h in headers] for row in data]
            table = ax.table(cellText=rows, colLabels=headers, loc="center")
            table.scale(1, 2)
        else:
            ax.text(0.5, 0.5, "Unsupported chart type", ha="center", va="center")

        ax.set_title(title)
        if x_label:
            ax.set_xlabel(x_label)
        if y_label:
            ax.set_ylabel(y_label)
        self.figure.tight_layout()
        plt.show(block=False)


def render_chart(chart_spec: Dict[str, Any]) -> None:
    if chart_spec is None:
        return
    renderer.render(chart_spec if isinstance(chart_spec, dict) else chart_spec.model_dump())


renderer = ChartRenderer()
