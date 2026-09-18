"""Configuração de cada tipo de importação (espelho de server/importTypes.ts)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ColumnKind = Literal["text", "numeric", "integer", "date", "boolean", "jsonb", "time", "duration"]


@dataclass(frozen=True)
class ImportColumn:
	name: str
	kind: ColumnKind


@dataclass(frozen=True)
class ImportTypeConfig:
	id: str
	label: str
	table: str
	key_columns: tuple[str, ...]
	columns: tuple[ImportColumn, ...]
	snapshot: bool
	# Tabelas de cadastro (clientes, vendedores, gerências, ...) não têm colunas
	# data_importacao/importacao_id — só atualizado_em (DEFAULT now()). Tabelas
	# transacionais (vendas, metas, visitas) e os indicadores diários (snapshot)
	# têm essas colunas de auditoria. Ver app.upsert.upsert_rows.
	tracks_import: bool = True
	# Quando True, a planilha pode legitimamente repetir a mesma combinação
	# de key_columns (ex.: o mesmo cliente aparecendo mais de uma vez na
	# mesma aba) — nesse caso NÃO se faz UPSERT por chave nem se descarta
	# duplicata nenhuma. Em vez disso, cada importação apaga o snapshot
	# inteiro da data_referencia e regrava todas as linhas do arquivo,
	# exatamente como constam nele. Requer snapshot=True e uma PK própria
	# (id) na tabela, já que key_columns deixa de servir de chave única.
	replace_snapshot_rows: bool = False
	# Quando True, cada importação apaga a tabela inteira e regrava TODAS as
	# linhas do arquivo (sem dedupe). Usado em cadastros/listas onde a planilha
	# é a fonte completa e códigos podem se repetir (ex.: sortimento).
	# Requer PK própria (id), não a chave de negócio.
	replace_all_rows: bool = False
	# Nome da coluna jsonb que recebe o restante das colunas não mapeadas
	# do cabeçalho (ex.: fabricantes em não positivados).
	dynamic_json_column: str | None = None


IMPORT_TYPE_CONFIGS: dict[str, ImportTypeConfig] = {
	"vendas": ImportTypeConfig(
		id="vendas",
		label="Vendas & Faturamento",
		table="vendas",
		key_columns=("numero_pedido",),
		snapshot=False,
		columns=(
			ImportColumn("numero_pedido", "text"),
			ImportColumn("data_emissao", "date"),
			ImportColumn("cod_cliente", "text"),
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("valor_total", "numeric"),
		),
	),
	"metas": ImportTypeConfig(
		id="metas",
		label="Metas Comerciais",
		table="metas_mensais",
		key_columns=("ano_mes", "cod_vendedor", "fabricante"),
		snapshot=False,
		columns=(
			ImportColumn("ano_mes", "text"),
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("fabricante", "text"),
			ImportColumn("meta_faturamento", "numeric"),
			ImportColumn("meta_cobertura", "numeric"),
		),
	),
	"clientes": ImportTypeConfig(
		id="clientes",
		label="Base de Clientes",
		table="clientes",
		key_columns=("cod_cliente",),
		snapshot=False,
		tracks_import=False,
		columns=(
			ImportColumn("cod_cliente", "text"),
			ImportColumn("razao_social", "text"),
			ImportColumn("cnpj", "text"),
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("status", "text"),
			ImportColumn("e_rede", "boolean"),
		),
	),
	"vendedores": ImportTypeConfig(
		id="vendedores",
		label="Vendedores",
		table="vendedores",
		key_columns=("cod_vendedor",),
		snapshot=False,
		tracks_import=False,
		columns=(
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("nome", "text"),
			ImportColumn("email", "text"),
			ImportColumn("equipe", "text"),
		),
	),
	"equipes": ImportTypeConfig(
		id="equipes",
		label="Equipes Comerciais",
		table="equipes",
		key_columns=("nome_equipe",),
		snapshot=False,
		tracks_import=False,
		columns=(
			ImportColumn("nome_equipe", "text"),
			ImportColumn("supervisor", "text"),
			ImportColumn("gerencia", "text"),
		),
	),
	"supervisores": ImportTypeConfig(
		id="supervisores",
		label="Supervisores",
		table="supervisores",
		key_columns=("nome_supervisor",),
		snapshot=False,
		tracks_import=False,
		columns=(
			ImportColumn("nome_supervisor", "text"),
			ImportColumn("gerencia", "text"),
			ImportColumn("email", "text"),
		),
	),
	"gerencias": ImportTypeConfig(
		id="gerencias",
		label="Gerências",
		table="gerencias",
		key_columns=("codigo_gerencia",),
		snapshot=False,
		tracks_import=False,
		columns=(
			ImportColumn("codigo_gerencia", "text"),
			ImportColumn("nome_gerencia", "text"),
		),
	),
	"fabricantes": ImportTypeConfig(
		id="fabricantes",
		label="Fabricantes / Indústrias",
		table="fabricantes",
		key_columns=("nome_fabricante",),
		snapshot=False,
		tracks_import=False,
		columns=(
			ImportColumn("nome_fabricante", "text"),
			ImportColumn("razao_social", "text"),
			ImportColumn("cnpj", "text"),
		),
	),
	"categorias": ImportTypeConfig(
		id="categorias",
		label="Categorias de Produtos",
		table="categorias",
		key_columns=("cod_categoria",),
		snapshot=False,
		tracks_import=False,
		columns=(
			ImportColumn("cod_categoria", "text"),
			ImportColumn("nome_categoria", "text"),
			ImportColumn("fabricante", "text"),
		),
	),
	"produtos": ImportTypeConfig(
		id="produtos",
		label="Produtos / Sortimentos",
		table="produtos",
		key_columns=("cod_produto",),
		snapshot=False,
		tracks_import=False,
		columns=(
			ImportColumn("cod_produto", "text"),
			ImportColumn("descricao", "text"),
			ImportColumn("fabricante", "text"),
			ImportColumn("categoria", "text"),
			ImportColumn("preco_tabela", "numeric"),
		),
	),
	"sortimento": ImportTypeConfig(
		id="sortimento",
		label="Lista de Sortimento",
		table="sortimento",
		# key_columns só para validação de obrigatoriedade — a PK real é `id`
		# e a importação regrava a tabela inteira (replace_all_rows).
		key_columns=("cod_produto",),
		snapshot=False,
		tracks_import=False,
		replace_all_rows=True,
		columns=(
			# Nomes alinhados com src/pages/admin/Importacao.tsx
			ImportColumn("cod_produto", "text"),
			ImportColumn("produto", "text"),
			ImportColumn("fabricante", "text"),
			ImportColumn("categoria", "text"),
			ImportColumn("linha", "text"),
		),
	),
	"visitas": ImportTypeConfig(
		id="visitas",
		label="Roteiros de Visitas & Positivação",
		table="visitas",
		key_columns=("cod_cliente", "cod_vendedor", "data_visita"),
		snapshot=False,
		columns=(
			ImportColumn("cod_cliente", "text"),
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("data_visita", "date"),
			ImportColumn("status_visita", "text"),
		),
	),
	"indicadores_vendedor": ImportTypeConfig(
		id="indicadores_vendedor",
		label='Indicadores Diários do Vendedor (aba "Mês")',
		table="indicadores_vendedor",
		key_columns=("data_referencia", "cod_vendedor"),
		snapshot=True,
		columns=(
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("gerencia", "text"),
			ImportColumn("nome_vendedor", "text"),
			ImportColumn("meta_faturamento", "numeric"),
			ImportColumn("realizado_faturamento", "numeric"),
			ImportColumn("meta_cobertura", "numeric"),
			ImportColumn("realizado_cobertura", "numeric"),
			ImportColumn("meta_sortimento", "numeric"),
			ImportColumn("realizado_sortimento", "numeric"),
			ImportColumn("pct_margem", "numeric"),
		),
	),
	"indicadores_fabricante": ImportTypeConfig(
		id="indicadores_fabricante",
		label='Indicadores Diários por Fabricante (aba "Categorias")',
		table="indicadores_fabricante",
		key_columns=("data_referencia", "cod_vendedor", "fabricante"),
		snapshot=True,
		columns=(
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("fabricante", "text"),
			ImportColumn("gerencia", "text"),
			ImportColumn("equipe", "text"),
			ImportColumn("meta", "numeric"),
			ImportColumn("realizado", "numeric"),
			ImportColumn("cobertura", "numeric"),
			ImportColumn("realizado_cobertura", "numeric"),
			ImportColumn("pct_margem", "numeric"),
		),
	),
	# Top Clientes — aba "top_20_clientes": ranking por vendedor/equipe/gerência.
	"top_clientes__top_20_clientes": ImportTypeConfig(
		id="top_clientes__top_20_clientes",
		label='Top Clientes — Top 20 (aba "top_20_clientes")',
		table="top_20_clientes",
		key_columns=("data_referencia", "cod_vendedor", "cod_cliente"),
		snapshot=True,
		replace_snapshot_rows=True,
		columns=(
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("nivel", "text"),
			ImportColumn("gerencia", "text"),
			ImportColumn("equipe", "text"),
			ImportColumn("nome_vendedor", "text"),
			ImportColumn("pasta", "text"),
			ImportColumn("cod_cliente", "text"),
			ImportColumn("cliente_redes", "text"),
			ImportColumn("trimestre_25", "numeric"),
			ImportColumn("trimestre_26", "numeric"),
			ImportColumn("pct_cresc_trimestre", "numeric"),
			ImportColumn("mes_25", "numeric"),
			ImportColumn("mes_26", "numeric"),
			ImportColumn("pct_cresc_mes", "numeric"),
		),
	),
	# Top Clientes — aba "top_clientes": venda total no mês por cliente.
	# Alimenta o Top 10 Clientes do Dashboard.
	"top_clientes__top_clientes": ImportTypeConfig(
		id="top_clientes__top_clientes",
		label='Top Clientes — Venda Total no Mês (aba "top_clientes")',
		table="top_clientes",
		key_columns=("data_referencia", "cod_cliente"),
		snapshot=True,
		replace_snapshot_rows=True,
		columns=(
			ImportColumn("gerencia", "text"),
			ImportColumn("equipe", "text"),
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("nome_vendedor", "text"),
			ImportColumn("cod_cliente", "text"),
			ImportColumn("cliente", "text"),
			ImportColumn("municipio", "text"),
			ImportColumn("venda_total_mes", "numeric"),
		),
	),
	"indicadores_positivacao": ImportTypeConfig(
		id="indicadores_positivacao",
		label='Indicadores Diários de Positivação (aba "Positivação")',
		table="indicadores_positivacao",
		key_columns=("data_referencia", "cod_vendedor"),
		snapshot=True,
		columns=(
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("equipe", "text"),
			ImportColumn("visitas_previstas", "integer"),
			ImportColumn("visitas_realizadas", "integer"),
			ImportColumn("vendas_previstas", "integer"),
			ImportColumn("vendas_realizadas", "integer"),
			ImportColumn("fora_de_rota", "integer"),
			ImportColumn("gps_ok", "integer"),
			ImportColumn("pedidos", "integer"),
			ImportColumn("apontamentos", "integer"),
		),
	),
	# Dados App — aba "Mês" (mesmo destino de indicadores_vendedor + campos extras da planilha)
	"dados_app__mes": ImportTypeConfig(
		id="dados_app__mes",
		label="Dados App — Mês",
		table="indicadores_vendedor",
		key_columns=("data_referencia", "cod_vendedor"),
		snapshot=True,
		columns=(
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("gerencia", "text"),
			ImportColumn("nome_vendedor", "text"),
			ImportColumn("meta_faturamento", "numeric"),
			ImportColumn("realizado_faturamento", "numeric"),
			ImportColumn("meta_cobertura", "numeric"),
			ImportColumn("realizado_cobertura", "numeric"),
			ImportColumn("meta_sortimento", "numeric"),
			ImportColumn("realizado_sortimento", "numeric"),
			ImportColumn("pct_margem", "numeric"),
			ImportColumn("data_inicial_faseamento", "date"),
			ImportColumn("realizado_faseamento", "numeric"),
			ImportColumn("meta_faseamento", "numeric"),
			ImportColumn("realizado_faseamento_2", "numeric"),
			ImportColumn("data_inicial_desconcentracao", "date"),
			ImportColumn("data_final_desconcentracao", "date"),
			ImportColumn("meta_desconcentracao", "numeric"),
			ImportColumn("realizado_desconcentracao", "numeric"),
			ImportColumn("visitas_diaria", "integer"),
			ImportColumn("positivacao_diaria", "integer"),
			ImportColumn("fora_de_rota_diaria", "integer"),
			ImportColumn("visitas_acumulada", "integer"),
			ImportColumn("positivacao_acumulada", "integer"),
			ImportColumn("fora_de_rota_acumulada", "integer"),
			ImportColumn("data_inicial_faseamento_ii", "date"),
			ImportColumn("data_final_faseamento_ii", "date"),
			ImportColumn("meta_faseamento_ii", "numeric"),
			ImportColumn("realizado_faseamento_ii", "numeric"),
			ImportColumn("data_inicial_desafio", "date"),
			ImportColumn("data_final_desafio", "date"),
			ImportColumn("meta_desafio", "numeric"),
			ImportColumn("realizado_desafio", "numeric"),
		),
	),
	"dados_app__positivacao": ImportTypeConfig(
		id="dados_app__positivacao",
		label="Dados App — Positivação",
		table="indicadores_positivacao",
		key_columns=("data_referencia", "cod_vendedor"),
		snapshot=True,
		columns=(
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("equipe", "text"),
			ImportColumn("visitas_previstas", "integer"),
			ImportColumn("visitas_realizadas", "integer"),
			ImportColumn("vendas_previstas", "integer"),
			ImportColumn("vendas_realizadas", "integer"),
			ImportColumn("fora_de_rota", "integer"),
			ImportColumn("gps_ok", "integer"),
			ImportColumn("pedidos", "integer"),
			ImportColumn("apontamentos", "integer"),
		),
	),
	"dados_app__categorias": ImportTypeConfig(
		id="dados_app__categorias",
		label="Dados App — Categorias com Fórmulas",
		table="indicadores_fabricante",
		key_columns=("data_referencia", "cod_vendedor", "fabricante"),
		snapshot=True,
		columns=(
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("fabricante", "text"),
			ImportColumn("gerencia", "text"),
			ImportColumn("equipe", "text"),
			ImportColumn("meta", "numeric"),
			ImportColumn("realizado", "numeric"),
			ImportColumn("cobertura", "numeric"),
			ImportColumn("realizado_cobertura", "numeric"),
			ImportColumn("pct_margem", "numeric"),
		),
	),
	# Não Positivados — cada fabricante é uma coluna própria na planilha real
	# (matriz cliente x fabricante), então só os campos de identificação do
	# cliente são mapeados explicitamente; todo o resto do cabeçalho é
	# capturado automaticamente na coluna jsonb "fabricantes" (ver
	# dynamic_json_column em app.upsert.map_and_validate_rows). Isso também
	# habilita o filtro por categoria/fabricante na tela.
	"nao_positivados__por_vendedor": ImportTypeConfig(
		id="nao_positivados__por_vendedor",
		label='Não Positivados — Por Vendedor',
		table="nao_positivados_vendedor",
		key_columns=("data_referencia", "cod_vendedor", "cod_cliente"),
		snapshot=True,
		dynamic_json_column="fabricantes",
		columns=(
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("cod_cliente", "text"),
			ImportColumn("razao_social", "text"),
			ImportColumn("nome_fantasia", "text"),
			ImportColumn("municipio", "text"),
			ImportColumn("fabricantes", "jsonb"),
		),
	),
	"nao_positivados__equipe": ImportTypeConfig(
		id="nao_positivados__equipe",
		label='Não Positivados — Equipe',
		table="nao_positivados_equipe",
		key_columns=("data_referencia", "equipe", "cod_cliente"),
		snapshot=True,
		dynamic_json_column="fabricantes",
		columns=(
			ImportColumn("equipe", "text"),
			ImportColumn("cod_cliente", "text"),
			ImportColumn("razao_social", "text"),
			ImportColumn("nome_fantasia", "text"),
			ImportColumn("municipio", "text"),
			ImportColumn("fabricantes", "jsonb"),
		),
	),
	"nao_positivados__chok_total": ImportTypeConfig(
		id="nao_positivados__chok_total",
		label='Não Positivados — Chok Total',
		table="nao_positivados_chok_total",
		key_columns=("data_referencia", "cod_cliente"),
		snapshot=True,
		dynamic_json_column="fabricantes",
		columns=(
			ImportColumn("cod_cliente", "text"),
			ImportColumn("razao_social", "text"),
			ImportColumn("nome_fantasia", "text"),
			ImportColumn("municipio", "text"),
			ImportColumn("fabricantes", "jsonb"),
		),
	),
	# Raio-X — aba "Acompanhamento" (planilha diária fornecida pelo SAR).
	# Uma linha por (data_referencia, cod_vendedor); igual em espírito aos
	# demais indicadores_* (snapshot diário, nunca sobrescreve outro período).
	# Nomes alinhados com src/pages/admin/Importacao.tsx e server/importTypes.ts.
	"raiox": ImportTypeConfig(
		id="raiox",
		label="Raio-X — Acompanhamento",
		table="raiox",
		key_columns=("data_referencia", "cod_vendedor"),
		snapshot=True,
		columns=(
			ImportColumn("cod_vendedor", "text"),
			ImportColumn("vendedor", "text"),
			ImportColumn("equipe", "text"),
			ImportColumn("visitas_previstas", "integer"),
			ImportColumn("visitas_realizadas", "integer"),
			ImportColumn("visitas_fora_rota", "integer"),
			ImportColumn("perc_gps", "numeric"),
			ImportColumn("apontamentos_inconsistencia", "text"),
			ImportColumn("positiva_prevista", "integer"),
			ImportColumn("pedidos", "integer"),
			ImportColumn("perc_positivacao", "numeric"),
			ImportColumn("fora_rota_positivacao", "integer"),
			ImportColumn("perc_fora_rota", "numeric"),
			ImportColumn("produtividade", "numeric"),
			ImportColumn("hora_inicio", "time"),
			ImportColumn("hora_check_in", "time"),
			ImportColumn("hora_check_out", "time"),
			ImportColumn("hora_fim", "time"),
			ImportColumn("tempo_campo", "duration"),
			ImportColumn("acumulado_prevista", "integer"),
			ImportColumn("acumulado_realizadas", "integer"),
			ImportColumn("acumulado_porcentagem", "numeric"),
			ImportColumn("acumulado_fora_rota", "integer"),
			ImportColumn("perc_fora_rota_acumulado", "numeric"),
			ImportColumn("acumulado_positivacao_visitas", "integer"),
			ImportColumn("acumulado_positivacao_pedidos", "integer"),
			ImportColumn("perc_positivacao_acumulado", "numeric"),
			ImportColumn("acumulado_positivacao_fora_rota", "integer"),
			ImportColumn("perc_positivacao_fora_rota", "numeric"),
		),
	),
	# Vendedor Detalhado — planilha visita a visita (cliente, ação, rota,
	# permanência, venda). Várias linhas por vendedor/dia: cada importação
	# substitui o snapshot inteiro da data_referencia. Nomes alinhados com
	# src/pages/admin/Importacao.tsx e server/importTypes.ts.
	"vendedor_detalhado": ImportTypeConfig(
		id="vendedor_detalhado",
		label="Vendedor Detalhado",
		table="vendedor_detalhado",
		key_columns=("data_referencia", "codigo_vendedor"),
		snapshot=True,
		replace_snapshot_rows=True,
		columns=(
			ImportColumn("gerencia", "text"),
			ImportColumn("supervisao", "text"),
			ImportColumn("codigo_vendedor", "text"),
			ImportColumn("vendedor", "text"),
			ImportColumn("codigo_cliente", "text"),
			ImportColumn("nome_cliente", "text"),
			ImportColumn("acao", "text"),
			ImportColumn("data", "date"),
			ImportColumn("dentro_rota", "boolean"),
			ImportColumn("hora", "time"),
			ImportColumn("permanencia", "duration"),
			ImportColumn("venda", "boolean"),
			ImportColumn("valor_venda", "numeric"),
			ImportColumn("motivo_nao_venda", "text"),
			ImportColumn("motivo_nao_visita", "text"),
		),
	),
}


def get_import_type_config(tipo_id: str) -> ImportTypeConfig | None:
	if not tipo_id:
		return None
	normalized = tipo_id.strip()
	# exact match
	if normalized in IMPORT_TYPE_CONFIGS:
		return IMPORT_TYPE_CONFIGS[normalized]
	# case-insensitive
	lower = normalized.lower()
	for k in IMPORT_TYPE_CONFIGS:
		if k.lower() == lower:
			return IMPORT_TYPE_CONFIGS[k]
	# composite like 'dados_app__mes' or 'raiox__Acompanhamento' -> try base
	base = normalized.split("__")[0].strip()
	if base in IMPORT_TYPE_CONFIGS:
		return IMPORT_TYPE_CONFIGS[base]
	for k in IMPORT_TYPE_CONFIGS:
		if k.lower() == base.lower():
			return IMPORT_TYPE_CONFIGS[k]
	return None

