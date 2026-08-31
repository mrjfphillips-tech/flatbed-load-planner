/**
 * Azure AI Search index definition for the PTV Discovery Coach knowledge base.
 * Requirements: 8.1
 */
import type {
  SearchIndex,
  SearchField,
  VectorSearch,
} from '@azure/search-documents';

const VECTOR_DIMENSIONS = 1536; // OpenAI text-embedding-ada-002 / text-embedding-3-small

/**
 * Creates the Azure AI Search index schema with BM25 text fields
 * and a dense vector field for hybrid retrieval.
 */
export function createSearchIndexDefinition(indexName: string): SearchIndex {
  const fields: SearchField[] = [
    {
      name: 'id',
      type: 'Edm.String',
      key: true,
      filterable: true,
    },
    {
      name: 'content',
      type: 'Edm.String',
      searchable: true,
      analyzerName: 'standard.lucene',
    },
    {
      name: 'canonicalFields',
      type: 'Collection(Edm.String)',
      filterable: true,
      searchable: true,
    },
    {
      name: 'frameworkNativeFields',
      type: 'Collection(Edm.String)',
      filterable: true,
      searchable: true,
    },
    {
      name: 'framework',
      type: 'Edm.String',
      filterable: true,
      searchable: true,
    },
    {
      name: 'sourceDocumentId',
      type: 'Edm.String',
      filterable: true,
    },
    {
      name: 'sourceDocumentTitle',
      type: 'Edm.String',
      searchable: true,
    },
    {
      name: 'sourceDocumentAuthor',
      type: 'Edm.String',
      searchable: true,
    },
    {
      name: 'sectionTitle',
      type: 'Edm.String',
      searchable: true,
    },
    {
      name: 'pageNumber',
      type: 'Edm.Int32',
      filterable: true,
    },
    {
      name: 'chunkIndex',
      type: 'Edm.Int32',
      filterable: true,
      sortable: true,
    },
    {
      name: 'version',
      type: 'Edm.Int32',
      filterable: true,
    },
    {
      name: 'permittedRoles',
      type: 'Collection(Edm.String)',
      filterable: true,
    },
    {
      name: 'permittedTeams',
      type: 'Collection(Edm.String)',
      filterable: true,
    },
    {
      name: 'embedding',
      type: 'Collection(Edm.Single)',
      searchable: true,
      vectorSearchDimensions: VECTOR_DIMENSIONS,
      vectorSearchProfileName: 'default-vector-profile',
    },
  ];

  const vectorSearch: VectorSearch = {
    algorithms: [
      {
        name: 'hnsw-algorithm',
        kind: 'hnsw',
        parameters: {
          metric: 'cosine',
          m: 4,
          efConstruction: 400,
          efSearch: 500,
        },
      },
    ],
    profiles: [
      {
        name: 'default-vector-profile',
        algorithmConfigurationName: 'hnsw-algorithm',
      },
    ],
  };

  return {
    name: indexName,
    fields,
    vectorSearch,
  };
}
