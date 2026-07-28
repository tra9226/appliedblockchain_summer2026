// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NaiveCredentialRegistry (fair full-record baseline)
 * @notice Comparison baseline for the storage trade-off study. This contract is
 *         FEATURE-IDENTICAL to CredentialRegistry -- same issuer whitelist, same
 *         status/timestamp lifecycle, same six events, same holder-controlled
 *         access, and the same view functions. The ONLY difference is that
 *         issueCredential ALSO writes the full credential record on-chain in the
 *         clear, instead of leaving the record off-chain behind a keccak256
 *         anchor. Because everything else is identical, the gas delta isolates
 *         the cost of the on-chain storage strategy alone.
 *
 *         This is still a deliberate anti-pattern (personal data becomes public
 *         and permanent); it exists only to be measured, not to be deployed.
 */
contract NaiveCredentialRegistry {
    enum Status {
        None,
        Active,
        Revoked
    }

    struct Credential {
        address issuer;
        address holder;
        uint64 issuedAt;
        uint64 updatedAt;
        Status status;
        string metadataURI;
        // --- the ONLY difference vs CredentialRegistry: the record, on-chain ---
        string studentName;
        string program;
        string gpa;
        string conferredDate;
        string institution;
        string transcriptDigest;
    }

    // Bundled record input keeps issueCredential under the EVM stack-slot limit.
    struct RecordInput {
        string studentName;
        string program;
        string gpa;
        string conferredDate;
        string institution;
        string transcriptDigest;
    }

    address public admin;
    mapping(address => string) public issuerName;
    mapping(address => bool) public isIssuer;
    mapping(bytes32 => Credential) private credentials;
    mapping(bytes32 => mapping(address => bool)) private accessGranted;

    event IssuerAdded(address indexed issuer, string name);
    event IssuerRemoved(address indexed issuer);
    event CredentialIssued(
        bytes32 indexed id,
        address indexed issuer,
        address indexed holder,
        uint64 issuedAt
    );
    event CredentialRevoked(bytes32 indexed id, address indexed issuer, uint64 revokedAt);
    event AccessGranted(bytes32 indexed id, address indexed holder, address indexed verifier);
    event AccessRevoked(bytes32 indexed id, address indexed holder, address indexed verifier);

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

    function addIssuer(address issuer, string calldata name) external onlyAdmin {
        require(issuer != address(0), "Zero address");
        require(bytes(name).length > 0, "Name required");
        require(!isIssuer[issuer], "Already an issuer");
        isIssuer[issuer] = true;
        issuerName[issuer] = name;
        emit IssuerAdded(issuer, name);
    }

    function removeIssuer(address issuer) external onlyAdmin {
        require(isIssuer[issuer], "Not an issuer");
        isIssuer[issuer] = false;
        delete issuerName[issuer];
        emit IssuerRemoved(issuer);
    }

    function issueCredential(
        bytes32 id,
        address holder,
        string calldata metadataURI,
        RecordInput calldata r
    ) external onlyIssuer {
        require(id != bytes32(0), "Empty id");
        require(holder != address(0), "Zero holder");
        require(credentials[id].status == Status.None, "Already issued");

        credentials[id] = Credential({
            issuer: msg.sender,
            holder: holder,
            issuedAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            status: Status.Active,
            metadataURI: metadataURI,
            studentName: r.studentName,
            program: r.program,
            gpa: r.gpa,
            conferredDate: r.conferredDate,
            institution: r.institution,
            transcriptDigest: r.transcriptDigest
        });

        emit CredentialIssued(id, msg.sender, holder, uint64(block.timestamp));
    }

    function revokeCredential(bytes32 id) external onlyIssuer {
        Credential storage c = credentials[id];
        require(c.status == Status.Active, "Not active");
        require(c.issuer == msg.sender, "Not issuing issuer");
        c.status = Status.Revoked;
        c.updatedAt = uint64(block.timestamp);
        emit CredentialRevoked(id, msg.sender, uint64(block.timestamp));
    }

    function grantAccess(bytes32 id, address verifier) external {
        require(credentials[id].holder == msg.sender, "Not credential holder");
        require(verifier != address(0), "Zero verifier");
        accessGranted[id][verifier] = true;
        emit AccessGranted(id, msg.sender, verifier);
    }

    function revokeAccess(bytes32 id, address verifier) external {
        require(credentials[id].holder == msg.sender, "Not credential holder");
        accessGranted[id][verifier] = false;
        emit AccessRevoked(id, msg.sender, verifier);
    }

    function verifyCredential(bytes32 id)
        external
        view
        returns (
            bool exists,
            address issuer,
            address holder,
            Status status,
            uint64 issuedAt,
            uint64 updatedAt
        )
    {
        Credential storage c = credentials[id];
        exists = c.status != Status.None;
        return (exists, c.issuer, c.holder, c.status, c.issuedAt, c.updatedAt);
    }

    function getMetadataURI(bytes32 id) external view returns (string memory) {
        Credential storage c = credentials[id];
        require(c.status != Status.None, "No such credential");
        require(
            msg.sender == c.holder ||
                msg.sender == c.issuer ||
                accessGranted[id][msg.sender],
            "Access denied"
        );
        return c.metadataURI;
    }

    function hasAccess(bytes32 id, address verifier) external view returns (bool) {
        return accessGranted[id][verifier];
    }

    function isValid(bytes32 id) external view returns (bool) {
        return credentials[id].status == Status.Active;
    }
}
