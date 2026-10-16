#!/usr/bin/env python3
"""Generate the static trace-case-study figure used by the project page.

The script intentionally uses only the Python standard library. It reads
released MAS-Sys runs and writes self-contained SVGs. Use --all to regenerate
the three carousel figures and their summary JSON; released traces are read-only.
"""

from __future__ import annotations

import argparse
import html
import json
import math
from pathlib import Path


RUN_ID = "20260503_011552"
EXAMPLES = [
    {"run_id": RUN_ID, "hardware": "4×H200", "jps": "0.05", "backend": "Continuum"},
    {"run_id": "20260506_102249", "hardware": "4×H200", "jps": "0.10", "backend": "Continuum"},
    {"run_id": "20260502_071419", "hardware": "2×H200", "jps": "0.02", "backend": "ORLA+SGLang"},
]
COLORS = {
    "swebench": "#4c78a8",
    "research_bench": "#9c6bb3",
    "deepfundbench": "#54a24b",
    "pinchbench": "#f58518",
    "paperbananabench": "#e45756",
}
LABELS = {
    "swebench": "SWE-Bench",
    "research_bench": "ResearchBench",
    "deepfundbench": "DeepFund",
    "pinchbench": "PinchBench",
    "paperbananabench": "PaperBanana",
}


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def polyline(points: list[tuple[float, float]], color: str, width: float = 2.0) -> str:
    coords = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    return (
        f'<polyline points="{coords}" fill="none" stroke="{color}" '
        f'stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"/>'
    )


def generate_figure(run_dir: Path, output: Path) -> dict:
    overall = load_json(run_dir / "overall_result.json")
    resources = load_json(run_dir / "resource_metrics.json")["samples"]
    job_results = load_json(run_dir / "job_results.json")
    by_job = {row["job_id"]: row for row in job_results}

    wall_start = float(overall["wall_start_time"])
    window_end = float(overall["arrival_window_end_time"]) - wall_start
    run_end = float(overall["run_completion_time"]) - wall_start

    jobs = []
    for job_id, row in by_job.items():
        job_dir = run_dir / "jobs" / job_id
        killed = row.get("error") == "killed for deadline"
        metadata_path = job_dir / "metadata.json"
        if (killed or not metadata_path.exists()) and (job_dir / "deadline_debug_metadata.json").exists():
            metadata_path = job_dir / "deadline_debug_metadata.json"
        metadata = load_json(metadata_path)
        start = float(metadata["e2e_start_time"]) - wall_start
        end = float(metadata["e2e_end_time"]) - wall_start
        if end < start:
            raise ValueError(f"Invalid execution interval for {run_dir.name}/{job_id}")
        jobs.append(
            {
                "job_id": job_id,
                "benchmark": row["benchmark"],
                "start": start,
                "end": end,
                "status": "killed" if killed else row["status"],
            }
        )
    jobs.sort(key=lambda item: (item["start"], item["job_id"]))

    width, height = 1280, 1210
    left, right = 92, 1238
    plot_width = right - left
    gantt_top, gantt_bottom = 94, 415
    gantt_height = gantt_bottom - gantt_top
    pressure_top, pressure_height, panel_stride = 520, 140, 240
    max_time = math.ceil(max(run_end, max(job["end"] for job in jobs)) / 300) * 300
    time_ticks = list(range(0, max_time + 1, 300))

    def tx(value: float) -> float:
        return left + (value / max_time) * plot_width

    svg: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'<title>Job execution and resource pressure for run {run_dir.name}</title>',
        "<style>",
        "text{font-family:'Noto Sans',Arial,sans-serif;fill:#202124}",
        ".panel-title{font-size:17px;font-weight:700}",
        ".axis{font-size:12px;fill:#667085}",
        ".note{font-size:12px;fill:#667085}",
        ".legend{font-size:12px;fill:#434a54}",
        "</style>",
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        '<text class="panel-title" x="92" y="36">Job execution timeline</text>',
        f'<text class="note" x="{right}" y="36" text-anchor="end">{len(jobs)} submitted jobs</text>',
        '<text class="note" x="92" y="57">Each bar is one submitted job; color denotes workload family. End markers: × failed, | killed.</text>',
    ]

    legend_x = left
    for key in ["swebench", "research_bench", "deepfundbench", "pinchbench", "paperbananabench"]:
        label = LABELS[key]
        svg.append(f'<circle cx="{legend_x}" cy="73" r="5" fill="{COLORS[key]}"/>')
        svg.append(f'<text class="legend" x="{legend_x + 10}" y="77">{html.escape(label)}</text>')
        legend_x += 34 + len(label) * 7.1

    # Common time guides for the job timeline.
    for seconds in time_ticks:
        x = tx(seconds)
        svg.append(f'<line x1="{x:.1f}" y1="{gantt_top}" x2="{x:.1f}" y2="{gantt_bottom}" stroke="#edf0f3"/>')
        svg.append(f'<text class="axis" x="{x:.1f}" y="{gantt_bottom + 21}" text-anchor="middle">{seconds // 60}</text>')
    svg.append(f'<text class="axis" x="{(left + right) / 2:.1f}" y="{gantt_bottom + 43}" text-anchor="middle">Elapsed time (min)</text>')

    row_height = gantt_height / len(jobs)
    for index, job in enumerate(jobs):
        y = gantt_top + index * row_height + 0.35
        x1, x2 = tx(job["start"]), tx(job["end"])
        bar_height = max(1.0, row_height - 0.7)
        center_y = y + bar_height / 2
        svg.append('<g class="job-interval">')
        svg.append(f'<title>{html.escape(job["job_id"])} · {LABELS[job["benchmark"]]} · {job["status"]}</title>')
        svg.append(
            f'<rect x="{x1:.1f}" y="{y:.1f}" width="{max(1.2, x2 - x1):.1f}" '
            f'height="{bar_height:.1f}" rx="0.7" fill="{COLORS[job["benchmark"]]}"/>'
        )
        if job["status"] == "killed":
            svg.append(f'<line x1="{x2:.1f}" y1="{center_y - 2:.1f}" x2="{x2:.1f}" y2="{center_y + 2:.1f}" stroke="#202124" stroke-width="1.4"/>')
        elif job["status"] != "success":
            svg.append(f'<path d="M {x2 - 2:.1f},{center_y - 2:.1f} l 4,4 m -4,0 l 4,-4" stroke="#202124" stroke-width="1.2"/>')
        svg.append('</g>')

    window_x = tx(window_end)
    svg.append(f'<line x1="{window_x:.1f}" y1="{gantt_top - 8}" x2="{window_x:.1f}" y2="{gantt_bottom}" stroke="#3f4650" stroke-width="1.5" stroke-dasharray="5 4"/>')
    svg.append(f'<text class="axis" x="{window_x - 7:.1f}" y="{gantt_top - 14}" text-anchor="end">submission window closes</text>')

    # Pressure panels share the resource-sample timestamps. Concurrency here
    # counts recorded execution intervals at those timestamps. The summary card
    # retains the harness-level lifecycle peak from overall_result.json, which
    # can differ because of interval boundaries and sampling.
    sample_times = [float(row["timestamp"]) - wall_start for row in resources]
    active_jobs = [
        sum(job["start"] <= timestamp <= job["end"] for job in jobs)
        for timestamp in sample_times
    ]
    series = [
        ("Concurrent jobs", active_jobs, max(active_jobs) or 1, "#394b63", f'sampled peak {max(active_jobs)}'),
        (
            "GPU SM utilization",
            [float(row.get("gpu_sm_util") or 0) for row in resources],
            100,
            "#4c78a8",
            f'mean {overall["resources"]["mean_sm_util"]:.1f}%',
        ),
        (
            "KV-cache usage",
            [100 * float(row.get("kv_cache_usage") or 0) for row in resources],
            100,
            "#e45756",
            f'max {100 * overall["resources"]["max_kv_cache_usage"]:.1f}%',
        ),
    ]

    for panel_index, (title, values, ymax, color, stat) in enumerate(series):
        x0, x1 = left, right
        small_top = pressure_top + panel_index * panel_stride
        small_bottom = small_top + pressure_height
        title_y = small_top - 30
        svg.append(f'<text class="panel-title" x="{x0:.1f}" y="{title_y}">{html.escape(title)}</text>')
        svg.append(f'<text class="note" x="{x1:.1f}" y="{title_y}" text-anchor="end">{html.escape(stat)}</text>')
        svg.append(f'<rect x="{x0:.1f}" y="{small_top}" width="{plot_width:.1f}" height="{pressure_height}" rx="4" fill="#fafbfc" stroke="#e4e7eb"/>')
        for seconds in time_ticks:
            x = tx(seconds)
            svg.append(f'<line x1="{x:.1f}" y1="{small_top}" x2="{x:.1f}" y2="{small_bottom}" stroke="#edf0f3"/>')
        for frac in [0, 0.5, 1]:
            y = small_bottom - frac * (small_bottom - small_top)
            svg.append(f'<line x1="{x0:.1f}" y1="{y:.1f}" x2="{x1:.1f}" y2="{y:.1f}" stroke="#e8ebef"/>')
            label = f"{round(frac * ymax):g}" + ("%" if panel_index > 0 else "")
            svg.append(f'<text class="axis" x="{x0 - 8:.1f}" y="{y + 4:.1f}" text-anchor="end">{label}</text>')
        points = []
        for timestamp, value in zip(sample_times, values):
            x = tx(timestamp)
            y = small_bottom - (max(0, min(value, ymax)) / ymax) * (small_bottom - small_top)
            points.append((x, y))
        svg.append(polyline(points, color, 1.8))
        svg.append(f'<line x1="{window_x:.1f}" y1="{small_top}" x2="{window_x:.1f}" y2="{small_bottom}" stroke="#3f4650" stroke-dasharray="4 4"/>')
        for seconds in time_ticks:
            x = tx(seconds)
            svg.append(f'<text class="axis" x="{x:.1f}" y="{small_bottom + 20}" text-anchor="middle">{seconds // 60}</text>')
        svg.append(f'<text class="axis" x="{(x0 + x1) / 2:.1f}" y="{small_bottom + 41}" text-anchor="middle">Elapsed time (min)</text>')

    svg.append("</svg>")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(svg), encoding="utf-8")
    print(f"Wrote {output}")
    health = overall["backend_health"]
    return {
        "submitted": overall["submitted_jobs"],
        "succeeded": overall["succeeded_jobs"],
        "completed": overall["completed_within_window_jobs"],
        "llmCalls": overall["inference"]["llm_calls"],
        "peakConcurrent": overall["concurrency"]["max_concurrent_jobs"],
        "failedHealthChecks": health["failed_checks"],
        "healthChecks": health["checks"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--trace-root", type=Path, default=Path("/home/hz314/workspace/MAS-Sys-Traces/raw"))
    parser.add_argument("--run-id", default=RUN_ID)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "static/images/trace_case_study.svg")
    parser.add_argument("--all", action="store_true", help="Generate all three figures and their carousel summary data.")
    args = parser.parse_args()
    if not args.all:
        generate_figure(args.trace_root / args.run_id, args.output)
        return

    project = Path(__file__).resolve().parents[1]
    examples = []
    for index, example in enumerate(EXAMPLES):
        image = "static/images/trace_case_study.svg" if index == 0 else f'static/images/trace_case_study_{example["run_id"]}.svg'
        stats = generate_figure(args.trace_root / example["run_id"], project / image)
        examples.append({**example, "image": f"./{image}", "stats": stats})
    manifest = project / "data/trace_examples.json"
    manifest.write_text(json.dumps(examples, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {manifest}")


if __name__ == "__main__":
    main()
