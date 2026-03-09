"""Unit tests for graph topology — node definitions, dependencies, and agent roles."""

from backend.orchestrator.graph.topology import (
    GATE_NODES,
    NODE_AGENT_ROLE,
    NODE_DEPENDS_ON,
    NODE_SUCCESSOR,
    PIPELINE_NODES,
    QC_NODES,
    QC_REJECT_TARGET,
    stage_no_for_node,
)


class TestTopologyBasics:
    def test_node_count(self):
        assert len(PIPELINE_NODES) == 28  # 26 base + N07b + N16b

    def test_first_and_last_node(self):
        assert PIPELINE_NODES[0] == "N01"
        assert PIPELINE_NODES[-1] == "N26"

    def test_gate_nodes(self):
        assert GATE_NODES == {"N08", "N18", "N21", "N24"}

    def test_qc_nodes(self):
        assert QC_NODES == {"N03", "N11", "N15"}

    def test_qc_reject_targets(self):
        assert QC_REJECT_TARGET == {"N03": "N02", "N11": "N10", "N15": "N14"}

    def test_all_nodes_have_agent_role(self):
        for nid in PIPELINE_NODES:
            assert nid in NODE_AGENT_ROLE, f"missing agent role for {nid}"

    def test_all_nodes_have_dependencies(self):
        for nid in PIPELINE_NODES:
            assert nid in NODE_DEPENDS_ON, f"missing depends_on for {nid}"

    def test_all_nodes_have_valid_stage(self):
        for nid in PIPELINE_NODES:
            stage = stage_no_for_node(nid)
            assert 1 <= stage <= 4, f"bad stage for {nid}: {stage}"

    def test_terminal_node_successor(self):
        assert NODE_SUCCESSOR["N25"] == "N26"
        assert NODE_SUCCESSOR["N26"] is None


class TestNodeOrdering:
    def test_nodes_are_ordered(self):
        """Nodes follow ascending order; branch nodes (N07b, N16b) sort after their parent."""
        def sort_key(nid: str):
            # N07b -> (7, 'b'), N16b -> (16, 'b'), N01 -> (1, '')
            base = nid[1:]
            if base.endswith('b'):
                return (int(base[:-1]), 'b')
            return (int(base), '')
        keys = [sort_key(n) for n in PIPELINE_NODES]
        assert keys == sorted(keys)

    def test_successor_chain_covers_all(self):
        """Every non-terminal node should have a successor."""
        for nid in PIPELINE_NODES[:-1]:
            assert NODE_SUCCESSOR.get(nid) is not None, f"{nid} has no successor"
