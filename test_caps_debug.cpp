#include <iostream>
#include <cstring>

// Include the caps implementation directly for testing
#include "src/caps.cpp"

int main() {
    std::cout << "Testing caps..." << std::endl;
    
    auto kp = requiem::caps_generate_keypair();
    std::cout << "Public key: " << kp.public_key_hex << std::endl;
    std::cout << "Secret key length: " << kp.secret_key_hex.length() << std::endl;
    std::cout << "Secret key: " << kp.secret_key_hex << std::endl;
    
    auto token = requiem::caps_mint({"exec.run", "cas.put"}, "tenant-alpha",
                                    kp.secret_key_hex, kp.public_key_hex);
    
    std::cout << "Token fingerprint: " << token.fingerprint << std::endl;
    std::cout << "Token signature length: " << token.signature.length() << std::endl;
    std::cout << "Token signature: " << token.signature.substr(0, 16) << "..." << std::endl;
    
    auto result = requiem::caps_verify(token, "exec.run", kp.public_key_hex);
    std::cout << "Verify result: " << (result.ok ? "OK" : "FAIL") << std::endl;
    if (!result.ok) {
        std::cout << "Error: " << result.error << std::endl;
    }
    
    return result.ok ? 0 : 1;
}
