
def generate_chart_suggestions(question: str, schema: str, sql_query: str) -> Dict[str, Any]:
    prompt = f"""
You are a data visualization assistant.

Given the following user question, SQL query, and database schema, suggest all suitable Plotly Express chart types to visualize the query results. For each chart, provide a JSON object with a "chart_type" matching a Plotly Express function name (e.g., "bar", "line", "scatter", "histogram", "box", "pie", etc.), and any relevant keyword arguments like "x", "y", "z", "color", "size", "dimensions", "names", "values", "path", etc.

Supported Plotly Express chart types: bar, line, scatter, histogram, box, pie, density_heatmap, area, funnel, treemap, sunburst, violin, scatter_3d, surface, parallel_coordinates, parallel_categories, choropleth, choropleth_mapbox.

### User Question:
{question}

### SQL Query:
{sql_query}

### Schema:
{schema}

### Response Format:
{{
  "charts": [
    {{ "chart_type": "bar", "x": "product_name", "y": "total_sales" }},
    {{ "chart_type": "pie", "names": "product_name", "values": "total_sales" }}
  ]
}}
"""
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    headers = {"Content-Type": "application/json"}
    response = requests.post(GEMINI_URL, headers=headers, json=payload)
    response.raise_for_status()
    data = response.json()

    charts_json = None
    if "candidates" in data and data["candidates"]:
        candidate = data["candidates"][0]
        content = candidate.get("content")
        if isinstance(content, dict) and "parts" in content:
            charts_json = content["parts"][0].get("text")
        elif isinstance(content, str):
            charts_json = content
    if charts_json:
        try:
            return json.loads(charts_json)
        except json.JSONDecodeError:
            cleaned = charts_json.strip().strip("```json").strip("```")
            return json.loads(cleaned)
    return {"charts": []}

def plot_charts_from_config(df: pd.DataFrame, chart_config: Dict[str, Any]) -> List[Any]:
    figs: List[Any] = []
    for chart in chart_config.get("charts", []):
        chart_type = chart.get("chart_type", "").lower().replace(" ", "_")
        plot_fn = getattr(px, chart_type, None)
        kwargs = {k: v for k, v in chart.items() if k != "chart_type"}

        if callable(plot_fn):
            try:
                fig = plot_fn(df, **kwargs)
            except Exception:
                fig = fallback_table(df)
        else:
            fig = fallback_table(df)
        figs.append(fig)
    return figs

def fallback_table(df: pd.DataFrame) -> go.Figure:
    return go.Figure(data=[go.Table(
        header=dict(values=list(df.columns)),
        cells=dict(values=[df[col] for col in df.columns])
    )])








def process_question(question: str) -> dict:
    try:
        # 1) semantic search for relevant tables
        idxs        = semantic_search(question, _embed_model, _faiss_index, TOP_K)
        tables      = expand_with_related(idxs, _metadata, _rev_fk_map)
        schema_text = build_schema_snippet(tables, _metadata)

        # 2) format prompt
        prompt      = PROMPT_TEMPLATE.format(
            question=question,
            schema=schema_text,
            dialect=DIALECT
        )

        # 3) get SQL from Gemini
        gen_output = generate_sql_with_gemini(prompt)
        if not isinstance(gen_output, str):
            raise ValueError(f"Gemini returned non-text: {type(gen_output)}")

        final_sql = gen_output.strip().lstrip("```sql").rstrip("```").strip()

        # 4) execute SQL
        engine = create_engine(DB_URI)
        with engine.connect() as conn:
            rows = [dict(r._mapping) for r in conn.execute(text(final_sql)).fetchall()]
        df = pd.DataFrame(rows)

        # 5) chart generation
        chart_config = generate_chart_suggestions(question, schema_text, final_sql)
        
        figures = plot_charts_from_config(df, chart_config)
        chart_jsons = [fig.to_json() for fig in figures]

        return {
            "sql": final_sql,
            "results": rows,
            "charts": chart_jsons
        }

    except Exception as e:
        return {"sql": None, "results": [], "charts": [], "error": str(e)}
