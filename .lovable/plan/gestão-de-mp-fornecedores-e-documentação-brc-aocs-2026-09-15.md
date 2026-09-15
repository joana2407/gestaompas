# Gestão de MP, fornecedores e documentação (BRC / AOCS)

Alarga a aplicação atual (que já tem o inventário de 86 matérias-primas e a vigilância RASFF) com a gestão documental de MP e fornecedores para as 3 unidades fabris, aproveitando a estrutura do projeto anexado.

## O que vai passar a existir

### Fábricas
- Três unidades pré-criadas: Fábrica 1 (fatiados), Fábrica 2 (granel), Fábrica 3 (sem glúten).
- Cada fábrica tem as suas regras, incluindo o bloqueio total de glúten na Fábrica 3.
- Página com o retrato de cada unidade: MP ativas, MP em teste e avisos.

### Matérias-primas
- Cada MP fica ligada a uma ou mais fábricas, com estado próprio em cada uma (ativa, para testes, inativa).
- Alergénios registados nas 14 categorias do Regulamento (UE) 1169/2011, distinguindo presença na formulação de presença por contaminação cruzada.
- Cada MP pode ter vários fornecedores, com referência do fornecedor, país de origem, validade estipulada e indicação de fornecedor preferencial.
- Página de detalhe da MP com fábricas, alergénios, fornecedores e toda a documentação associada.

### Fornecedores
- Ficha do fornecedor com código, contacto comercial e contacto de qualidade.
- Lista das MP fornecidas e a que fábricas chegam.
- Estado de completude (completo, pendente, incompleto) com observações.

### Documentação
- Documentos por fornecedor e, quando aplicável, por par MP + fornecedor: certificados BRC/IFS/FSSC/ISO, declarações de alergénios, OGM, halal, kosher, análises laboratoriais, auditorias, fichas técnicas e outros.
- Cada documento guarda versão, data de emissão, data de validade, notas, quem carregou e o ficheiro em anexo.
- Ao carregar uma nova versão, a anterior fica arquivada no histórico em vez de desaparecer — pronto para auditoria.
- Semáforo automático de validade: válido, a expirar em 60 dias, a expirar em 30 dias, expirado.

### Controlo de qualidade
- Painel com contagens de documentos expirados e a expirar, MP sem fornecedor, MP sem documentação e fornecedores incompletos.
- Sinalizações: MP com vários fornecedores, alergénios críticos, e MP com glúten associada à Fábrica 3 (incompatibilidade bloqueante).
- Grelha de alergénios por MP e filtro por alergénio, fábrica, fornecedor e estado documental.
- Tudo acessível com os PIN já existentes da equipa de qualidade; nada muda no acesso.

## Notas técnicas

- Novas tabelas: `factories`, `suppliers`, `material_factories`, `material_suppliers`, `documents` (com `version`, `superseded_by`, `issued_on`, `expires_on`, `storage_path`), e colunas de alergénios em `raw_materials` (`allergens_formulation`, `allergens_contamination` como `text[]`).
- As três fábricas e as suas regras são inseridas na própria migração.
- Ficheiros dos documentos num bucket privado de armazenamento, com URLs assinados gerados no servidor.
- Todo o acesso continua a passar pelas funções de servidor protegidas pelo PIN (`src/lib/data.functions.ts` + novo `src/lib/docs.functions.ts`); nenhuma tabela fica aberta ao browser.
- Constantes partilhadas dos 14 alergénios, tipos de documento e regras das fábricas em `src/lib/domain.ts`.
- Novas páginas: `/fabricas`, `/fornecedores`, `/fornecedor/$id`, `/materia-prima/$id`, `/documentos`, com a lista de MP atual passada a tabela filtrável; navegação alargada no cabeçalho.
- A vigilância RASFF e os relatórios semanais mantêm-se intactos e passam a poder usar as fábricas e alergénios no cruzamento.

## Faseamento

1. Base de dados, fábricas, alergénios e ligações MP ↔ fábrica ↔ fornecedor.
2. Fornecedores e documentação com versões, validade e anexos.
3. Painel de conformidade, sinalizações e filtros.
