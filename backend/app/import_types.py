"""Configuração de cada tipo de importação (espelho de server/importTypes.ts)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ColumnKind = Literal["text", "numeric", "integer", "date", "boolean", "jsonb"]


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
}


def get_import_type_config(tipo_id: str) -> ImportTypeConfig | None:
    return IMPORT_TYPE_CONFIGS.get(tipo_id)
