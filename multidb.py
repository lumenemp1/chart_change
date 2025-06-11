def process_question(question: str, selected_dbs: List[str]) -> Dict[str, Any]:
    all_results = []

    for db_key in selected_dbs:
        try:
            resource = DB_RESOURCES[db_key]
            embed_model = resource["embed_model"]
            faiss_index = resource["faiss_index"]
            metadata = resource["metadata"]
            rev_fk_map = resource["rev_fk_map"]
            db_uri = resource["db_uri"]

            # 1. Semantic search
            idxs = semantic_search(question, embed_model, faiss_index, TOP_K)
            tables = expand_with_related(idxs, metadata, rev_fk_map)
            schema_text = build_schema_snippet(tables, metadata)

            # 2. Prompt creation
            prompt = PROMPT_TEMPLATE.format(
                question=question,
                schema=schema_text,
                dialect=DIALECT
            )

            # 3. SQL generation
            gen_output = generate_sql_with_gemini(prompt)
            final_sql = gen_output.strip().lstrip("```sql").rstrip("```").strip()

            # 4. SQL execution
            engine = create_engine(db_uri)
            try:
                with engine.connect() as conn:
                    rows = [dict(r._mapping) for r in conn.execute(text(final_sql)).fetchall()]
            except Exception as db_err:
                print(f"[{db_key}] SQL error, retrying: {db_err}")
                corrected_sql = retry_sql_with_error_context(
                    question, schema_text, final_sql, str(db_err), DIALECT
                )
                with engine.connect() as conn:
                    rows = [dict(r._mapping) for r in conn.execute(text(corrected_sql)).fetchall()]
                final_sql = corrected_sql

            all_results.append({
                "db": db_key,
                "sql": final_sql,
                "results": rows
            })

        except Exception as e:
            all_results.append({
                "db": db_key,
                "sql": None,
                "results": [],
                "error": str(e)
            })

    sql_by_db = {res["db"]: res["sql"] for res in all_results if res.get("sql")}
    print(f"sql_by_db {sql_by_db}")
    print(f"all results{all_results}")
    # 5. Get chart suggestion from Gemini using SQL queries
    chart_config = generate_chart_suggestions(question,all_results)
                                        
    print(f"char_config{chart_config}")

    # 6. Normalize data for plotting
    merged_df = normalize_and_merge_results(all_results, chart_config)
    print(f"merged_df{merged_df}")

    # 7. Generate Plotly figures
    figures = plot_charts_from_config(merged_df, chart_config)
    figures_json=[fig.to_json() for fig in figures]

    return {
    "sql_queries": {r["db"]: r["sql"] for r in all_results if r.get("sql")},
    "db_results": {r["db"]: r["results"] for r in all_results},
    "charts": figures_json
    }
