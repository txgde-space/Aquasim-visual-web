/** Shared ns-3 attribute checking and socket assembly; no protocol-specific parameter rules. */
export const PROTOCOL_RUNTIME_CC = String.raw`
#include <stdexcept>
#include <utility>

using VisualAttributes = std::vector<std::pair<std::string, std::string>>;

static std::string VisualTrim(const std::string& text) {
    const auto first = text.find_first_not_of(" \t\r\n");
    return first == std::string::npos ? "" : text.substr(first, text.find_last_not_of(" \t\r\n") - first + 1);
}

static TypeId VisualType(const std::string& name) {
    TypeId tid;
    if (!TypeId::LookupByNameFailSafe(name, &tid) || !tid.HasConstructor()) {
        throw std::runtime_error("Unregistered or non-constructible TypeId: " + name);
    }
    return tid;
}

static ObjectFactory VisualFactory(const std::string&, const VisualAttributes&, unsigned = 0);

// Parse the public ObjectFactory text syntax before construction. In ns-3's
// PointerValue parser an unknown TypeId otherwise terminates the process.
static Ptr<AttributeValue> VisualPointer(const std::string& text, const PointerChecker& checker, unsigned depth) {
    const std::string value = VisualTrim(text);
    if (value == "0") return Create<PointerValue>();
    const auto bracket = value.find('[');
    const std::string type = VisualTrim(value.substr(0, bracket));
    const TypeId tid = VisualType(type);
    const TypeId expected = checker.GetPointeeTypeId();
    if (tid != expected && !tid.IsChildOf(expected)) {
        throw std::runtime_error(type + " does not implement " + expected.GetName());
    }
    VisualAttributes attributes;
    if (bracket != std::string::npos) {
        if (value.back() != ']') throw std::runtime_error("Unclosed ObjectFactory attribute list");
        const auto body = value.substr(bracket + 1, value.size() - bracket - 2);
        std::size_t begin = 0;
        int nesting = 0;
        for (std::size_t i = 0; i <= body.size(); ++i) {
            if (i < body.size()) {
                if (body[i] == '[') ++nesting;
                if (body[i] == ']') --nesting;
                if (nesting < 0) throw std::runtime_error("Invalid ObjectFactory brackets");
            }
            if (i == body.size() || (body[i] == '|' && nesting == 0)) {
                const auto entry = body.substr(begin, i - begin);
                if (!entry.empty()) {
                    const auto equals = entry.find('=');
                    if (equals == std::string::npos) throw std::runtime_error("ObjectFactory attributes require name=value");
                    attributes.emplace_back(VisualTrim(entry.substr(0, equals)), entry.substr(equals + 1));
                }
                begin = i + 1;
            }
        }
        if (nesting != 0) throw std::runtime_error("Invalid ObjectFactory brackets");
    }
    return Create<PointerValue>(VisualFactory(type, attributes, depth + 1).Create<Object>());
}

static ObjectFactory VisualFactory(const std::string& type, const VisualAttributes& attributes, unsigned depth) {
    if (depth > 32) throw std::runtime_error("ObjectFactory nesting exceeds 32 levels");
    const TypeId tid = VisualType(type);
    ObjectFactory factory;
    factory.SetTypeId(tid);
    for (const auto& [name, text] : attributes) {
        TypeId::AttributeInformation info;
        if (!tid.LookupAttributeByName(name, &info) || !(info.flags & TypeId::ATTR_CONSTRUCT)) {
            throw std::runtime_error(type + "." + name + " is not a constructible attribute");
        }
        Ptr<AttributeValue> value;
        try {
            if (auto pointer = dynamic_cast<const PointerChecker*>(PeekPointer(info.checker))) {
                value = VisualPointer(text, *pointer, depth);
                if (!info.checker->Check(*value)) value = nullptr;
            } else {
                value = info.checker->CreateValidValue(StringValue(text));
            }
        } catch (const std::exception& error) {
            throw std::runtime_error(type + "." + name + " = " + text + ": " + error.what());
        }
        if (!value) {
            const auto constraint = info.checker->HasUnderlyingTypeInformation()
                ? info.checker->GetUnderlyingTypeInformation() : info.checker->GetValueTypeName();
            throw std::runtime_error("Invalid attribute " + type + "." + name + " = " + text + " (expected " + constraint + ")");
        }
        factory.Set(name, *value);
    }
    return factory;
}

class AquaVisualSocket : public AquaSimSocket {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualSocket")
            .SetParent<AquaSimSocket>().AddConstructor<AquaVisualSocket>();
        return tid;
    }
    int Bind() override {
        const int result = AquaSimSocket::Bind();
        if (result == 0) m_bound = true;
        return result;
    }
    int Bind(const Address& address) override {
        const int result = AquaSimSocket::Bind(address);
        if (result == 0) m_bound = true;
        return result;
    }
    int Bind6() override { return Bind(); }
    int Connect(const Address& address) override {
        if (!m_bound && Bind() != 0) return -1;
        return AquaSimSocket::Connect(address);
    }
    int Close() override { m_bound = false; return AquaSimSocket::Close(); }
private:
    bool m_bound = false;
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualSocket);

class AquaVisualSocketFactory : public SocketFactory {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualSocketFactory")
            .SetParent<SocketFactory>().AddConstructor<AquaVisualSocketFactory>();
        return tid;
    }
    Ptr<Socket> CreateSocket() override {
        auto socket = CreateObject<AquaVisualSocket>();
        socket->SetNode(GetObject<Node>());
        return socket;
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualSocketFactory);
`
