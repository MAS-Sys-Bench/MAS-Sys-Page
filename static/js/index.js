const BACKENDS = {
  'vllm, vllm-omni': { label: 'vLLM', color: '#4c78a8' },
  sglang: { label: 'SGLang', color: '#f58518' },
  'orla+vllm, vllm-omni': { label: 'Orla + vLLM', color: '#54a24b' },
  'orla+sglang': { label: 'Orla + SGLang', color: '#b279a2' },
  'continuum, vllm-omni': { label: 'Continuum', color: '#e45756' }
};

const TASKS = {
  swe: {
    label: 'SWE-Bench',
    group: 'SWE-Bench (resolved)',
    countGroup: 'SWE-Bench'
  },
  research: {
    label: 'ResearchBench',
    group: 'ResearchBench (embedding_sim)',
    countGroup: 'ResearchBench'
  },
  deepfund: {
    label: 'DeepFund',
    group: 'DeepFund (profit/flat/loss)',
    countGroup: 'DeepFund'
  },
  pinch: {
    label: 'PinchBench',
    group: 'PinchBench (combined_score)',
    countGroup: 'PinchBench'
  },
  paperbanana: {
    label: 'PaperBanana',
    group: 'PaperBanana (overall_score / 10)',
    countGroup: 'PaperBanana'
  }
};

const formatters = {
  integer: (value) => value == null ? '—' : Math.round(value).toLocaleString(),
  decimal: (value) => value == null ? '—' : value.toFixed(2),
  seconds: (value) => {
    if (value == null) return '—';
    if (value >= 1000) return `${value.toFixed(0)} s`;
    if (value >= 100) return `${value.toFixed(1)} s`;
    return `${value.toFixed(2)} s`;
  },
  ratio: (value) => value == null ? '—' : `${(value * 100).toFixed(1)}%`,
  rawPercent: (value) => value == null ? '—' : `${value.toFixed(1)}%`,
  tokens: (value) => value == null ? '—' : Math.round(value).toLocaleString(),
  dollars: (value) => value == null ? '—' : `$${value.toFixed(3)}`,
  text: (value) => value == null || value === '' ? '—' : String(value)
};

function fieldMetric(key, label, field, format, direction = null, detail = null) {
  return {
    key,
    label,
    direction,
    value: (item) => number(item.run[field]),
    format: formatters[format],
    detail
  };
}

const METRIC_GROUPS = {
  overview: {
    label: 'System overview',
    defaultSort: 'successRate',
    columns: [
      {
        key: 'completionRate', label: 'Completion', direction: 'desc', format: formatters.ratio,
        value: (item) => item.completionRate,
        detail: (item) => `${item.completed}/${item.submitted} completed`
      },
      {
        key: 'successRate', label: 'Execution success', direction: 'desc', format: formatters.ratio,
        value: (item) => item.successRate,
        detail: (item) => `${item.succeeded}/${item.submitted} succeeded`
      },
      fieldMetric('failedJobs', 'Failed', 'failed_jobs', 'integer', 'asc'),
      fieldMetric('killedJobs', 'Killed', 'killed_jobs', 'integer', 'asc'),
      fieldMetric('runElapsed', 'Run elapsed', 'run_completion_elapsed_s', 'seconds', 'asc'),
      fieldMetric('p95Runtime', 'P95 E2E', 'p95_job_runtime_s', 'seconds', 'asc'),
      fieldMetric('p95Kv', 'P95 KV', 'p95_kv_cache_usage', 'ratio', 'asc')
    ],
    note: ''
  },
  latency: {
    label: 'Latency & queueing',
    defaultSort: 'p95Runtime',
    columns: [
      fieldMetric('meanRuntime', 'Mean E2E', 'mean_job_runtime_s', 'seconds', 'asc'),
      fieldMetric('p95Runtime', 'P95 E2E', 'p95_job_runtime_s', 'seconds', 'asc'),
      fieldMetric('maxRuntime', 'Max E2E', 'max_job_runtime_s', 'seconds', 'asc'),
      fieldMetric('runElapsed', 'Run elapsed', 'run_completion_elapsed_s', 'seconds', 'asc'),
      fieldMetric('queuedJobs', 'Jobs queued', 'jobs_with_job_queueing_delay', 'integer', 'asc'),
      fieldMetric('meanQueue', 'Mean job queue', 'mean_job_queueing_delay_s', 'seconds', 'asc'),
      fieldMetric('maxQueue', 'Max job queue', 'max_job_queueing_delay_s', 'seconds', 'asc')
    ],
    note: 'E2E values are computed over jobs with recorded runtimes. Job queue delay is the harness-level wait before job execution begins.'
  },
  inference: {
    label: 'Inference',
    defaultSort: 'p95ClientLatency',
    columns: [
      fieldMetric('llmCalls', 'LLM calls', 'llm_calls', 'integer'),
      fieldMetric('meanClientLatency', 'Mean client', 'mean_client_latency_total_per_job_s', 'seconds', 'asc'),
      fieldMetric('p95ClientLatency', 'P95 client', 'p95_client_latency_total_per_job_s', 'seconds', 'asc'),
      fieldMetric('meanBackendLatency', 'Mean backend', 'mean_backend_latency_total_per_job_s', 'seconds', 'asc'),
      fieldMetric('p95BackendLatency', 'P95 backend', 'p95_backend_latency_total_per_job_s', 'seconds', 'asc'),
      fieldMetric('meanBackendQueue', 'Mean backend queue', 'mean_backend_queue_wait_total_per_job_s', 'seconds', 'asc'),
      fieldMetric('p95BackendQueue', 'P95 backend queue', 'p95_backend_queue_wait_total_per_job_s', 'seconds', 'asc')
    ],
    note: 'Client and backend values aggregate model-call latency within each job; backend queue wait is reported by the serving backend when available.'
  },
  tokensTools: {
    label: 'Tokens & tools',
    defaultSort: 'meanToolLatency',
    columns: [
      fieldMetric('meanTokens', 'Mean tokens', 'mean_total_tokens_per_job', 'tokens'),
      fieldMetric('p95Tokens', 'P95 tokens', 'p95_total_tokens_per_job', 'tokens'),
      fieldMetric('meanInputTokens', 'Mean input', 'mean_input_tokens_per_job', 'tokens'),
      fieldMetric('meanOutputTokens', 'Mean output', 'mean_output_tokens_per_job', 'tokens'),
      fieldMetric('meanToolCalls', 'Mean tool calls', 'mean_tool_calls_per_job', 'decimal'),
      fieldMetric('maxToolCalls', 'Max tool calls', 'max_tool_calls_per_job', 'integer'),
      fieldMetric('meanToolLatency', 'Mean tool time', 'mean_tool_call_latency_per_job_s', 'seconds', 'asc'),
      fieldMetric('maxToolLatency', 'Max tool time', 'max_tool_call_latency_per_job_s', 'seconds', 'asc')
    ],
    note: 'Token and tool aggregates use only jobs for which the corresponding trace metric is present; lower token counts are not treated as universally better.'
  },
  concurrencyGraph: {
    label: 'Concurrency & graph',
    defaultSort: 'meanCriticalPath',
    columns: [
      fieldMetric('meanConcurrentJobs', 'Mean jobs', 'mean_concurrent_jobs', 'decimal'),
      fieldMetric('p95ConcurrentJobs', 'P95 jobs', 'p95_concurrent_jobs', 'decimal'),
      fieldMetric('maxConcurrentJobs', 'Max jobs', 'max_concurrent_jobs', 'integer'),
      fieldMetric('meanConcurrentCalls', 'Mean LLM calls', 'mean_concurrent_llm_calls', 'decimal'),
      fieldMetric('p95ConcurrentCalls', 'P95 LLM calls', 'p95_concurrent_llm_calls', 'decimal'),
      fieldMetric('meanAgents', 'Mean agents', 'mean_agents_per_job', 'decimal'),
      fieldMetric('meanDepth', 'Mean depth', 'mean_agent_graph_depth', 'decimal'),
      fieldMetric('meanCriticalPath', 'Mean critical path', 'mean_critical_path_latency_s', 'seconds', 'asc'),
      fieldMetric('meanParallelism', 'Mean parallelism', 'mean_parallelism', 'decimal')
    ],
    note: 'Graph metrics summarize executed MAS traces; concurrency is an observed workload property and is not assigned a universal better direction.'
  },
  resources: {
    label: 'Resources & health',
    defaultSort: 'p95Kv',
    columns: [
      fieldMetric('meanCpu', 'Mean CPU', 'mean_cpu_usage_pct', 'rawPercent'),
      fieldMetric('maxCpu', 'Max CPU', 'max_cpu_usage_pct', 'rawPercent'),
      fieldMetric('meanSm', 'Mean SM', 'mean_sm_util_pct', 'rawPercent'),
      fieldMetric('maxSm', 'Max SM', 'max_sm_util_pct', 'rawPercent'),
      fieldMetric('meanKv', 'Mean KV', 'mean_kv_cache_usage', 'ratio', 'asc'),
      fieldMetric('p95Kv', 'P95 KV', 'p95_kv_cache_usage', 'ratio', 'asc'),
      fieldMetric('maxKv', 'Max KV', 'max_kv_cache_usage', 'ratio', 'asc'),
      fieldMetric('meanReuse', 'Mean KV reuse', 'mean_kv_reuse_rate', 'ratio'),
      fieldMetric('healthFailures', 'Health failures', 'backend_health_failed_checks', 'integer', 'asc'),
      {
        key: 'healthStatus', label: 'Health status', direction: null,
        value: (item) => item.run.backend_health_status,
        format: formatters.text
      }
    ],
    note: 'CPU and SM fields are reported in percentage points; KV-cache usage and reuse are ratios converted to percentages.'
  },
  orla: {
    label: 'Orla details',
    defaultSort: 'meanOrlaQueue',
    columns: [
      fieldMetric('orlaJobs', 'Jobs with ORLA', 'jobs_with_orla_metrics', 'integer'),
      fieldMetric('meanOrlaQueue', 'Mean ORLA queue', 'mean_orla_queue_wait_per_job_s', 'seconds', 'asc'),
      fieldMetric('p95OrlaQueue', 'P95 ORLA queue', 'p95_orla_queue_wait_per_job_s', 'seconds', 'asc'),
      fieldMetric('schedulerTime', 'Scheduler decision', 'mean_orla_scheduler_decision_per_job_s', 'seconds', 'asc'),
      fieldMetric('dispatchTime', 'Dispatch', 'mean_orla_dispatch_per_job_s', 'seconds', 'asc'),
      fieldMetric('meanOrlaBackend', 'Mean backend request', 'mean_orla_backend_request_latency_per_job_s', 'seconds', 'asc'),
      fieldMetric('p95OrlaBackend', 'P95 backend request', 'p95_orla_backend_request_latency_per_job_s', 'seconds', 'asc'),
      fieldMetric('orlaCost', 'Estimated cost', 'total_orla_estimated_cost_usd', 'dollars', 'asc')
    ],
    note: 'ORLA metrics are backend-specific and are therefore blank for serving cells that do not use ORLA.'
  },
  quality: {
    label: 'Task quality',
    defaultSort: 'swe',
    columns: [],
    note: ''
  }
};

const dataStore = {
  runs: [],
  qualityByRun: new Map()
};

const tableStates = [
  {
    id: 'system-2h', kind: 'system', hardware: '2xH200', jps: '0.05',
    metricGroup: 'overview', sortKey: 'successRate'
  },
  {
    id: 'system-4h', kind: 'system', hardware: '4xH200', jps: '0.05',
    metricGroup: 'overview', sortKey: 'successRate'
  },
  {
    id: 'quality-2h', kind: 'quality', hardware: '2xH200', jps: '0.05',
    qualityMode: 'effective_mean_score', sortKey: 'swe'
  },
  {
    id: 'quality-4h', kind: 'quality', hardware: '4xH200', jps: '0.05',
    qualityMode: 'effective_mean_score', sortKey: 'swe'
  }
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((values) => values.some((value) => value !== ''));
}

function parseTwoHeaderCsv(text) {
  const rows = parseCsv(text);
  const groups = rows[0];
  const fields = rows[1];
  return rows.slice(2).map((values) => {
    const flat = {};
    const grouped = {};
    fields.forEach((field, index) => {
      flat[field] = values[index];
      grouped[`${groups[index]}::${field}`] = values[index];
    });
    return { flat, grouped };
  });
}

function number(value) {
  if (value == null || value === '' || value === 'N/A') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function backendInfo(raw) {
  return BACKENDS[raw] || { label: raw, color: '#7d8794' };
}

function taskScore(item, key, qualityMode) {
  const task = TASKS[key];
  return number(item.quality?.grouped[`${task.group}::${qualityMode}`]);
}

function taskCount(item, key, field) {
  const task = TASKS[key];
  return number(item.quality?.grouped[`${task.countGroup}::${field}`]);
}

function qualityColumns(tableState) {
  return Object.entries(TASKS).map(([key, task]) => ({
    key,
    label: task.label,
    direction: 'desc',
    value: (item) => taskScore(item, key, tableState.qualityMode),
    format: formatters.ratio,
    detail: (item) => {
      const evaluated = taskCount(item, key, 'evaluated_jobs');
      const submitted = taskCount(item, key, 'submitted_jobs');
      return `${evaluated ?? '—'}/${submitted ?? '—'} evaluated`;
    }
  }));
}

function currentGroup(tableState) {
  if (tableState.kind === 'quality') {
    return { ...METRIC_GROUPS.quality, columns: qualityColumns(tableState) };
  }
  return METRIC_GROUPS[tableState.metricGroup];
}

function enrich(record) {
  const run = record.flat;
  const submitted = number(run.submitted_jobs) || 0;
  const incomplete = number(run.jobs_not_completed_within_test_window) || 0;
  const succeeded = number(run.succeeded_jobs) || 0;
  return {
    run,
    quality: dataStore.qualityByRun.get(run.run_id),
    submitted,
    completed: submitted - incomplete,
    succeeded,
    completionRate: submitted ? (submitted - incomplete) / submitted : null,
    successRate: submitted ? succeeded / submitted : null
  };
}

function selectedRows(tableState) {
  return dataStore.runs
    .filter(({ flat }) => flat.hardware === tableState.hardware && flat.target_jps === tableState.jps)
    .map(enrich);
}

function sortRows(rows, columns, sortKey) {
  const metric = columns.find((column) => column.key === sortKey);
  if (!metric) return rows;
  const direction = metric.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = metric.value(left);
    const b = metric.value(right);
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === 'string') return direction * a.localeCompare(b);
    return direction * (a - b);
  });
}

function renderMetricCell(item, column) {
  const value = column.value(item);
  const detail = column.detail ? column.detail(item) : '';
  return `<td data-metric="${column.key}">
    <span class="metric-value">${column.format(value)}</span>
    ${detail ? `<span class="metric-detail">${detail}</span>` : ''}
  </td>`;
}

function tableRoot(tableState) {
  return document.querySelector(`[data-table-id="${tableState.id}"]`);
}

function resetSortKey(tableState) {
  const group = currentGroup(tableState);
  const sortable = group.columns.filter((column) => column.direction);
  tableState.sortKey = sortable.find((column) => column.key === group.defaultSort)?.key
    || sortable[0]?.key
    || '';
}

function renderTable(tableState) {
  const root = tableRoot(tableState);
  const group = currentGroup(tableState);
  const rows = sortRows(selectedRows(tableState), group.columns, tableState.sortKey);
  const head = root.querySelector('[data-role="table-head"]');
  const body = root.querySelector('[data-role="table-body"]');

  head.innerHTML = `
    <tr class="group-head">
      <th colspan="2">Configuration</th>
      <th colspan="${group.columns.length}">${group.label}</th>
    </tr>
    <tr>
      <th class="rank-cell">Rank</th>
      <th class="config-cell">Serving cell</th>
      ${group.columns.map((column) => {
        const arrow = column.direction === 'desc' ? ' ↑' : column.direction === 'asc' ? ' ↓' : '';
        const sortable = column.direction ? ` data-sort-key="${column.key}"` : '';
        const active = column.key === tableState.sortKey ? ' class="active-sort"' : '';
        return `<th${sortable}${active}>${column.label}${arrow}</th>`;
      }).join('')}
    </tr>`;

  body.innerHTML = rows.map((item, rowIndex) => {
    const backend = backendInfo(item.run.backend);
    return `<tr>
      <td class="rank-cell"><span class="rank-badge">${rowIndex + 1}</span></td>
      <td class="config-cell"><span class="backend-badge" style="--backend-color:${backend.color}">${backend.label}</span></td>
      ${group.columns.map((column) => renderMetricCell(item, column)).join('')}
    </tr>`;
  }).join('');

  root.querySelectorAll('th[data-sort-key]').forEach((header) => {
    header.addEventListener('click', () => {
      tableState.sortKey = header.dataset.sortKey;
      renderTable(tableState);
    });
  });

  const note = root.querySelector('[data-role="table-note"]');
  note.textContent = group.note;
  note.hidden = !group.note;
}

function populateJps(tableState) {
  const root = tableRoot(tableState);
  const select = root.querySelector('[data-role="jps-filter"]');
  const values = [...new Set(
    dataStore.runs
      .filter(({ flat }) => flat.hardware === tableState.hardware)
      .map(({ flat }) => flat.target_jps)
  )].sort((left, right) => number(left) - number(right));
  if (!values.includes(tableState.jps)) tableState.jps = values[0];
  select.innerHTML = values.map((value) => `<option value="${value}">${value} jobs/s</option>`).join('');
  select.value = tableState.jps;
}

function populateMetricGroups(tableState) {
  const select = tableRoot(tableState).querySelector('[data-role="metric-group-filter"]');
  select.innerHTML = Object.entries(METRIC_GROUPS)
    .filter(([key]) => key !== 'quality')
    .map(([key, group]) => `<option value="${key}">${group.label}</option>`)
    .join('');
  select.value = tableState.metricGroup;
}

function bindControls(tableState) {
  const root = tableRoot(tableState);
  root.querySelector('[data-role="jps-filter"]').addEventListener('change', (event) => {
    tableState.jps = event.target.value;
    renderTable(tableState);
  });

  if (tableState.kind === 'system') {
    root.querySelector('[data-role="metric-group-filter"]').addEventListener('change', (event) => {
      tableState.metricGroup = event.target.value;
      resetSortKey(tableState);
      renderTable(tableState);
    });
  } else {
    root.querySelector('[data-role="quality-mode"]').addEventListener('change', (event) => {
      tableState.qualityMode = event.target.value;
      renderTable(tableState);
    });
  }
}

function setupTable(tableState) {
  populateJps(tableState);
  if (tableState.kind === 'system') populateMetricGroups(tableState);
  resetSortKey(tableState);
  bindControls(tableState);
  renderTable(tableState);
}

function showError(error) {
  document.querySelectorAll('[data-role="error-banner"]').forEach((banner) => {
    banner.hidden = false;
    banner.textContent = `Could not load the released CSV files. Serve this directory over HTTP before previewing the tables. ${error.message}`;
  });
  document.querySelectorAll('[data-role="table-body"]').forEach((body) => {
    body.innerHTML = '<tr><td class="loading-cell">Benchmark data unavailable.</td></tr>';
  });
}

async function setupTraceCarousel() {
  const root = document.querySelector('.trace-carousel');
  if (!root) return;
  try {
    const response = await fetch('./data/trace_examples.json');
    if (!response.ok) throw new Error('Trace example data unavailable.');
    const examples = await response.json();
    let currentIndex = 0;
    const dots = [...root.querySelectorAll('[data-trace-index]')];
    const image = root.querySelector('[data-trace-image]');

    function showExample(index) {
      currentIndex = (index + examples.length) % examples.length;
      const example = examples[currentIndex];
      const stats = example.stats;
      const title = `Example ${currentIndex + 1}: ${example.hardware} ${example.jps}job/s ${example.backend}`;
      root.querySelector('[data-trace-title]').textContent = title;
      root.querySelector('.trace-example-panel').setAttribute('aria-label', `Example ${currentIndex + 1} of ${examples.length}`);
      root.querySelector('[data-trace-link]').href = example.image;
      image.alt = `${title}. Timeline of ${stats.submitted} mixed-workload jobs aligned with concurrent jobs, GPU utilization, and KV-cache usage for run ${example.run_id}.`;
      image.src = example.image;
      dots.forEach((dot, dotIndex) => dot.setAttribute('aria-pressed', String(dotIndex === currentIndex)));
    }

    root.querySelector('.trace-carousel-prev').addEventListener('click', () => showExample(currentIndex - 1));
    root.querySelector('.trace-carousel-next').addEventListener('click', () => showExample(currentIndex + 1));
    dots.forEach((dot) => dot.addEventListener('click', () => showExample(Number(dot.dataset.traceIndex))));
    root.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      showExample(currentIndex + (event.key === 'ArrowLeft' ? -1 : 1));
    });
    examples.forEach((example) => {
      const preload = new Image();
      preload.src = example.image;
    });
    showExample(0);
    root.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  } catch (error) {
    root.querySelectorAll('.trace-carousel-arrow, .trace-carousel-dots').forEach((controls) => {
      controls.hidden = true;
    });
    console.warn(error);
  }
}

async function init() {
  try {
    const [runsResponse, qualityResponse] = await Promise.all([
      fetch('./data/runs.csv'),
      fetch('./data/quality.csv')
    ]);
    if (!runsResponse.ok || !qualityResponse.ok) throw new Error('One or more data files returned an HTTP error.');
    const [runsText, qualityText] = await Promise.all([runsResponse.text(), qualityResponse.text()]);
    dataStore.runs = parseTwoHeaderCsv(runsText);
    const quality = parseTwoHeaderCsv(qualityText);
    dataStore.qualityByRun = new Map(
      quality.map((record) => [record.grouped['Experiment Setup::run_id'], record])
    );

    tableStates.forEach(setupTable);
  } catch (error) {
    showError(error);
  }
}

setupTraceCarousel();
init();
