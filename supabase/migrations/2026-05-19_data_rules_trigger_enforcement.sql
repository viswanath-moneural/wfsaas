-- Data Rules Engine - trigger enforcement

create or replace function public.enforce_data_rules()
returns trigger
language plpgsql
security definer
as $$
declare
  v_element_key text;
  v_rule record;
  v_result boolean;
  v_sql text;
begin
  select element_key
  into v_element_key
  from public.element_definitions
  where table_name = tg_table_name
  limit 1;

  if v_element_key is null then
    return new;
  end if;

  for v_rule in
    select *
    from public.data_rule_definitions
    where element_key = v_element_key
      and is_active = true
      and (
        (tg_op = 'INSERT' and 'insert' = any(trigger_on))
        or
        (tg_op = 'UPDATE' and 'update' = any(trigger_on))
      )
  loop
    v_sql := v_rule.condition_formula;
    v_sql := regexp_replace(v_sql, '\{([a-zA-Z0-9_]+)\}', '(to_jsonb(NEW)->>\1)', 'g');
    v_sql := replace(v_sql, 'AND', 'AND');
    v_sql := replace(v_sql, 'OR', 'OR');
    v_sql := replace(v_sql, 'NOT', 'NOT');
    v_sql := regexp_replace(v_sql, 'IS_BLANK\((.*?)\)', '((\1) is null or btrim((\1)::text) = '''')', 'gi');
    v_sql := regexp_replace(v_sql, 'IS_NOT_BLANK\((.*?)\)', '((\1) is not null and btrim((\1)::text) <> '''')', 'gi');
    v_sql := regexp_replace(v_sql, 'LEN\((.*?)\)', 'length((\1)::text)', 'gi');
    v_sql := regexp_replace(v_sql, 'CONTAINS\((.*?),(.*?)\)', 'position((\2)::text in (\1)::text) > 0', 'gi');
    v_sql := regexp_replace(v_sql, 'STARTS_WITH\((.*?),(.*?)\)', 'left((\1)::text, length((\2)::text)) = (\2)::text', 'gi');
    v_sql := replace(v_sql, 'TODAY()', 'current_date');
    v_sql := replace(v_sql, 'NOW()', 'now()');

    begin
      execute format('select (%s)', v_sql) into v_result;
    exception when others then
      v_result := false;
    end;

    if coalesce(v_result, false) then
      raise exception 'DATA_RULE_VIOLATION: % | FIELD: % | RULE: %',
        v_rule.error_message,
        coalesce(v_rule.error_field_key, 'record'),
        v_rule.rule_key;
    end if;
  end loop;

  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select distinct table_name
    from public.element_definitions
    where is_core = true and table_name is not null
  loop
    execute format('drop trigger if exists trg_enforce_data_rules on public.%I', r.table_name);
    execute format('create trigger trg_enforce_data_rules before insert or update on public.%I for each row execute function public.enforce_data_rules()', r.table_name);
  end loop;
end $$;
