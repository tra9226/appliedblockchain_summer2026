// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NaiveCredentialRegistry
 * @notice DELIBERATE ANTI-PATTERN, built only as the comparison baseline for the
 *         storage trade-off evaluation. This variant stores the FULL credential
 *         record on-chain as strings instead of anchoring an off-chain record by
 *         hash. It exists to be measured against CredentialRegistry, not to be used.
 *
 * Why this is a bad design (and what the gas numbers will demonstrate):
 *  - Every character of every field is paid for at SSTORE rates (~20k gas per
 *    fresh 32-byte word), so issuance gas scales with record size.
 *  - Personal data (name, GPA, dates) becomes public and permanent on a public
 *    chain — an irreversible privacy violation.
 *  - The contract still needs roles/revocation, so it is strictly heavier than
 *    the anchor design with no compensating benefit.
 */
contract NaiveCredentialRegistry {
    enum Status {
        None,
        Active,
        Revoked
    }

    struct FullCredential {
        address issuer;
        address holder;
        uint64 issuedAt;
        Status status;
        // The anti-pattern: the actual record, on-chain, in the clear.
        string studentName;
        string program;
        string gpa;
        string conferredDate;
        string institution;
        string transcriptDigest;
    }

    // Input bundle: passing the record fields as a single struct keeps the
    // function below under the EVM's stack-slot limit.
    struct RecordInput {
        string studentName;
        string program;
        string gpa;
        string conferredDate;
        string institution;
        string transcriptDigest;
    }

    address public admin;
    mapping(address => bool) public isIssuer;
    mapping(bytes32 => FullCredential) private credentials;

    event CredentialIssued(bytes32 indexed id, address indexed issuer, address indexed holder);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    modifier onlyIssuer() {
        require(isIssuer[msg.sender], "Not authorized issuer");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function addIssuer(address issuer) external onlyAdmin {
        isIssuer[issuer] = true;
    }

    function issueCredential(
        bytes32 id,
        address holder,
        RecordInput calldata r
    ) external onlyIssuer {
        require(credentials[id].status == Status.None, "Already issued");
        credentials[id] = FullCredential({
            issuer: msg.sender,
            holder: holder,
            issuedAt: uint64(block.timestamp),
            status: Status.Active,
            studentName: r.studentName,
            program: r.program,
            gpa: r.gpa,
            conferredDate: r.conferredDate,
            institution: r.institution,
            transcriptDigest: r.transcriptDigest
        });
        emit CredentialIssued(id, msg.sender, holder);
    }

    function getCredential(bytes32 id) external view returns (FullCredential memory) {
        return credentials[id];
    }
}
