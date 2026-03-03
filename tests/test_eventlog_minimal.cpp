#include <iostream>
#include <filesystem>
#include <fstream>
#include <string>

namespace fs = std::filesystem;

int main() {
    std::cout << "Starting minimal EventLog test..." << std::endl;
    
    auto temp_dir = fs::temp_directory_path() / "evlog_test";
    fs::create_directories(temp_dir);
    auto path = (temp_dir / "events.ndjson").string();
    
    std::cout << "Temp path: " << path << std::endl;
    
    // Remove any existing file
    fs::remove(path);
    
    std::cout << "Creating EventLog..." << std::endl;
    {
        // Test basic file operations
        std::ofstream ofs(path, std::ios::app);
        if (!ofs.good()) {
            std::cerr << "Failed to open file for writing" << std::endl;
            return 1;
        }
        ofs << "{\"test\":1}" << std::endl;
        ofs.close();
        std::cout << "Wrote to file" << std::endl;
        
        // Read it back
        std::ifstream ifs(path);
        if (!ifs.good()) {
            std::cerr << "Failed to open file for reading" << std::endl;
            return 1;
        }
        std::string line;
        while (std::getline(ifs, line)) {
            std::cout << "Read line: " << line << std::endl;
        }
        ifs.close();
    }
    
    // Cleanup
    fs::remove_all(temp_dir);
    
    std::cout << "Test completed successfully!" << std::endl;
    return 0;
}
